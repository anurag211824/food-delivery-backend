import { Controller, Post, Get, Body, Req, Res, Param, NotFoundException, UseGuards } from '@nestjs/common';
import {
    ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
    ApiBody, ApiParam
} from '@nestjs/swagger';
import { auth } from "../lib/auth";
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { SignUpDto, SignInDto, SocialSignInDto } from './dto/auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthGuard } from './auth.guard';
import type { AuthenticatedRequest } from './auth.types';

@ApiTags('Account & Profile')
@Controller('/api/auth')
export class AuthController {

    constructor(private readonly prisma: PrismaService) { }

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
        const data = await response.json();
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

        res.set(Object.fromEntries(response.headers.entries()));
        const data: unknown = await response.json();
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

        // ─── Referral attribution for phone signups ───────────────────────
        // We parse the response first, THEN run the update and re-fetch the
        // user so the returned JSON reflects the actual referredById value,
        // not the stale null that Better Auth built before our update ran.
        if (response.ok && body.invitedByCode && data?.user?.id) {
            try {
                const referrer = await this.prisma.user.findUnique({
                    where: { referralCode: body.invitedByCode.toUpperCase() },
                    select: { id: true }
                });

                if (referrer) {
                    await this.prisma.user.updateMany({
                        where: { phoneNumber: body.phoneNumber, referredById: null },
                        data: { referredById: referrer.id }
                    });

                    // Re-fetch the updated user so the response shows the correct referredById
                    const updatedUser = await this.prisma.user.findUnique({
                        where: { id: data.user.id as string },
                        select: { referredById: true }
                    });

                    if (updatedUser) {
                        data.user = { ...data.user, referredById: updatedUser.referredById };
                    }
                }
            } catch {
                // Referral failure must never block login
            }
        }
        // ──────────────────────────────────────────────────────────────────

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