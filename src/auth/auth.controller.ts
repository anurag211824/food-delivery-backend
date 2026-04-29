import { Controller, Post, Get, Patch, Body, Req, Res, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
    ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
    ApiBody, ApiParam
} from '@nestjs/swagger';
import { auth } from "../lib/auth";
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { SignUpDto, SignInDto, SocialSignInDto, UpdateProfileDto } from './dto/auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';
import { ReferralsService } from '../referrals/referrals.service';

@ApiTags('Account & Profile')
@Controller('/api/auth')
export class AuthController {

    constructor(
        private readonly prisma: PrismaService,
        private readonly referralsService: ReferralsService,
    ) { }

    // ─── SIGN UP ──────────────────────────────────────────────────────────────
    @Post('sign-up/email')
    @ApiOperation({
        summary: 'Register with email',
        description: 'Create a new account using email + password. Optionally pass an `invitedByCode` to attribute a referral.'
    })
    @ApiBody({ type: SignUpDto })
    @ApiResponse({
        status: 201,
        description: 'Account created. Returns the new user object and session token.',
        schema: {
            example: {
                token: 'eyJhbGciOiJIUzI1NiJ9...',
                user: {
                    id: 'clxyz123',
                    name: 'John Doe',
                    email: 'john@example.com',
                    role: 'CUSTOMER',
                    referralCode: 'JOHN4823',
                    emailVerified: false,
                    createdAt: '2026-02-20T12:00:00.000Z'
                }
            }
        }
    })
    @ApiResponse({ status: 422, description: 'Email already in use or validation error' })
    async signUp(
        @Body() body: SignUpDto,
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        let referrerId: string | undefined;

        if (body.invitedByCode) {
            const referrer = await this.prisma.user.findUnique({
                where: { referralCode: body.invitedByCode }
            });
            referrerId = referrer?.id;
        }

        const response = await auth.api.signUpEmail({
            body: {
                ...body,
                referredById: referrerId
            },
            asResponse: true,
            headers: fromNodeHeaders(req.headers)
        });

        res.set(Object.fromEntries(response.headers.entries()));
        const data = await response.json() as { user?: { id: string } };

        // 💰 Award wallet bonuses if signup was successful and a code was provided
        if (response.ok && body.invitedByCode && data?.user?.id) {
            try {
                await this.referralsService.rewardReferral(
                    data.user.id,
                    body.invitedByCode,
                );
            } catch {
                // Reward failure must NEVER block account creation
            }
        }

        res.json(data);
    }

    // ─── SIGN IN ──────────────────────────────────────────────────────────────
    @Post('sign-in/email')
    @ApiOperation({
        summary: 'Sign in with email',
        description: 'Authenticate using email and password. Returns a session token to use as Bearer on protected endpoints.'
    })
    @ApiBody({ type: SignInDto })
    @ApiResponse({
        status: 200,
        description: 'Login successful. Use the returned `token` as `Authorization: Bearer <token>`.',
        schema: {
            example: {
                token: 'eyJhbGciOiJIUzI1NiJ9...',
                user: {
                    id: 'clxyz123',
                    name: 'John Doe',
                    email: 'john@example.com',
                    role: 'CUSTOMER'
                }
            }
        }
    })
    @ApiResponse({ status: 401, description: 'Invalid email or password' })
    async signIn(
        @Body() body: SignInDto,
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        const response = await auth.api.signInEmail({
            body: { ...body },
            asResponse: true,
            headers: fromNodeHeaders(req.headers)
        });

        res.set(Object.fromEntries(response.headers.entries()));
        const data: unknown = await response.json();
        res.json(data);
    }

    // ─── SIGN OUT ─────────────────────────────────────────────────────────────
    @Post('sign-out')
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Sign out',
        description: 'Invalidate the current session. Pass your Bearer token in the Authorization header.'
    })
    @ApiResponse({ status: 200, description: 'Session invalidated successfully', schema: { example: { success: true } } })
    @ApiResponse({ status: 401, description: 'Not authenticated' })
    async signOut(
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        const response = await auth.api.signOut({
            asResponse: true,
            headers: fromNodeHeaders(req.headers)
        });

        // ✅ This line sends the cookie-deletion instruction to the browser
        res.set(Object.fromEntries(response.headers.entries()));
        
        let data = { success: true };
        try {
            const text = await response.text();
            if (text) {
                data = JSON.parse(text);
            }
        } catch (e) {
            // response was empty, which is normal for signout
        }
        
        res.json(data);
    }

    // ─── SOCIAL SIGN IN ───────────────────────────────────────────────────────
    @Post('sign-in/social')
    @ApiOperation({
        summary: 'Social / OAuth sign in',
        description: 'Initiate Google OAuth. Returns a redirect URL to open in the browser.'
    })
    @ApiBody({ type: SocialSignInDto })
    @ApiResponse({
        status: 200,
        description: 'Returns the OAuth redirect URL',
        schema: { example: { url: 'https://accounts.google.com/o/oauth2/...', redirect: true } }
    })
    async socialSignIn(
        @Body() body: SocialSignInDto,
        @Res() res: Response,
    ): Promise<void> {
        const response = await auth.api.signInSocial({
            body: {
                provider: body.provider,
                callbackURL: body.callbackURL || '/dashboard'
            },
            asResponse: true,
        });

        res.set(Object.fromEntries(response.headers.entries()));
        const data: unknown = await response.json();
        res.json(data);
    }

    // ─── PHONE OTP ────────────────────────────────────────────────────────────
    @Post('phone-number/send-otp')
    @ApiOperation({
        summary: 'Send OTP to phone',
        description: 'Sends a 6-digit OTP via SMS to the provided phone number. Call this first, then verify with the `/verify` endpoint.'
    })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['phoneNumber'],
            properties: {
                phoneNumber: {
                    type: 'string',
                    example: '+919876543210',
                    description: 'Phone number in E.164 format (e.g. +91XXXXXXXXXX)'
                }
            }
        }
    })
    @ApiResponse({ status: 200, description: 'OTP sent successfully', schema: { example: { success: true } } })
    @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 OTP requests per minute
    async sendOTP(@Body() body: { phoneNumber: string }, @Req() req: Request, @Res() res: Response) {
        const response = await auth.api.sendPhoneNumberOTP({
            body: { phoneNumber: body.phoneNumber },
            headers: fromNodeHeaders(req.headers)
        });
        res.json(response);
    }

    @Post('phone-number/verify')
    @ApiOperation({
        summary: 'Verify OTP and login',
        description: 'Verify the OTP sent to the phone number. Creates an account if one does not exist. Optionally pass `invitedByCode` to attribute a referral.'
    })
    @ApiBody({
        schema: {
            type: 'object',
            required: ['phoneNumber', 'code'],
            properties: {
                phoneNumber: {
                    type: 'string',
                    example: '+919876543210',
                    description: 'Same phone number used in send-otp'
                },
                code: {
                    type: 'string',
                    example: '123456',
                    description: '6-digit OTP received via SMS'
                },
                invitedByCode: {
                    type: 'string',
                    example: 'PRIYA4823',
                    description: '(Optional) Referral code from a friend — only applied on first signup'
                }
            }
        }
    })
    @ApiResponse({
        status: 200,
        description: 'OTP verified. Returns session token.',
        schema: {
            example: {
                token: 'eyJhbGciOiJIUzI1NiJ9...',
                user: { id: 'clxyz123', phoneNumber: '+919876543210', role: 'CUSTOMER' }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
    @Throttle({ default: { ttl: 60000, limit: 5 } }) // 5 verification attempts per minute
    async phoneSignIn(
        @Body() body: { phoneNumber: string; code: string; invitedByCode?: string },
        @Req() req: Request,
        @Res() res: Response
    ) {
        const response = await auth.api.verifyPhoneNumber({
            body: {
                phoneNumber: body.phoneNumber,
                code: body.code
            },
            asResponse: true,
            headers: fromNodeHeaders(req.headers)
        });

        res.set(Object.fromEntries(response.headers.entries()));

        // Parse the response body FIRST (consuming the stream)
        const data = await response.json() as { status: boolean; token: string; user: Record<string, unknown> };

        // 💰 Award wallet bonuses if signup was successful and a code was provided
        if (response.ok && body.invitedByCode && data?.user?.id) {
            try {
                await this.referralsService.rewardReferral(
                    data.user.id as string,
                    body.invitedByCode,
                );
                // Reflect referredById in the response for the client
                const updatedUser = await this.prisma.user.findUnique({
                    where: { id: data.user.id as string },
                    select: { referredById: true }
                });
                if (updatedUser) {
                    data.user = { ...data.user, referredById: updatedUser.referredById };
                }
            } catch {
                // Reward failure must NEVER block login
            }
        }

        res.json(data);
    }

    // ─── REFERRAL ─────────────────────────────────────────────────────────────
    @Get('referral/verify/:code')
    @ApiOperation({
        summary: 'Verify a referral code',
        description: 'Check if a referral code is valid before the user completes signup. Returns the referrer\'s first name on success.'
    })
    @ApiParam({ name: 'code', example: 'PRIYA4823', description: 'The referral code to check (case-insensitive)' })
    @ApiResponse({
        status: 200,
        description: 'Code is valid',
        schema: { example: { valid: true, referrerName: 'Priya' } }
    })
    @ApiResponse({ status: 404, description: 'Referral code not found / invalid' })
    async verifyReferral(@Param('code') code: string) {
        const referrer = await this.prisma.user.findUnique({
            where: { referralCode: code.toUpperCase() },
            select: { name: true }
        });

        if (!referrer) {
            throw new NotFoundException('Invalid referral code');
        }

        return { valid: true, referrerName: referrer.name };
    }

    // ─── MY PROFILE ───────────────────────────────────────────────────────────
    @Get('me')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Get my profile',
        description: 'Returns the full profile of the logged-in user including their shareable referral code and how many friends they\'ve referred.'
    })
    @ApiResponse({
        status: 200,
        description: 'User profile',
        schema: {
            example: {
                id: 'clxyz123',
                name: 'Priya Sharma',
                email: 'priya@example.com',
                phoneNumber: '+919876543210',
                image: null,
                role: 'CUSTOMER',
                dob: null,
                gender: null,
                isVeg: false,
                language: 'en',
                referralCode: 'PRIYA4823',
                referredById: null,
                referralCount: 3,
                createdAt: '2026-02-20T12:00:00.000Z'
            }
        }
    })
    @ApiResponse({ status: 401, description: 'Not authenticated — send Bearer token' })
    async getMe(@Req() req: AuthenticatedRequest) {
        const user = await this.prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                image: true,
                role: true,
                dob: true,
                gender: true,
                isVeg: true,
                language: true,
                referralCode: true,
                referredById: true,
                _count: { select: { referrals: true } },
                createdAt: true,
            }
        });

        return {
            ...user,
            referralCount: user?._count.referrals ?? 0,
        };
    }

    @Patch('me')
    @UseGuards(AuthGuard)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Update my profile',
        description: 'Updates the logged-in user profile fields.'
    })
    @ApiBody({ type: UpdateProfileDto })
    @ApiResponse({
        status: 200,
        description: 'User profile updated successfully',
    })
    @ApiResponse({ status: 401, description: 'Not authenticated — send Bearer token' })
    async updateMe(@Req() req: AuthenticatedRequest, @Body() body: UpdateProfileDto) {
        const updateData: any = {};
        
        if (body.name !== undefined) updateData.name = body.name;
        if (body.image !== undefined) updateData.image = body.image;
        if (body.gender !== undefined) updateData.gender = body.gender;
        if (body.isVeg !== undefined) updateData.isVeg = body.isVeg;
        if (body.dob !== undefined) {
            updateData.dob = body.dob ? new Date(body.dob) : null;
        }

        const updatedUser = await this.prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                image: true,
                role: true,
                dob: true,
                gender: true,
                isVeg: true,
                language: true,
                referralCode: true,
                createdAt: true,
            }
        });

        return updatedUser;
    }

    // ─── OAUTH CALLBACK HANDLER ───────────────────────────────────────────────
    @Get('*')
    @ApiOperation({
        summary: 'OAuth callback handler',
        description: 'Internal route handled by Better Auth for Google OAuth callbacks and deep links. Do not call directly.'
    })
    async handleGetRoutes(
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        await toNodeHandler(auth)(req, res);
    }
}