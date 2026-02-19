import { Controller, Post, Get, Body, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { auth } from "../lib/auth";
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { SignUpDto, SignInDto, SocialSignInDto } from './dto/auth.dto';

@ApiTags('Account & Profile')
@Controller('/api/auth')
export class AuthController {

    @Post("sign-up/email")
    @ApiOperation({
        summary: 'Sign up with email',
        description: 'Create a new user account using email and password'
    })
    @ApiResponse({ status: 201, description: 'Account created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input or email already exists' })
    async signUp(
        @Body() body: SignUpDto,
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        const response = await auth.api.signUpEmail({
            body: { ...body },
            headers: fromNodeHeaders(req.headers)
        });
        res.json(response);
    }

    @Post('sign-in/email')
    @ApiOperation({
        summary: 'Sign in with email',
        description: 'Authenticate using email and password, returns session cookie'
    })
    @ApiResponse({ status: 200, description: 'Successfully authenticated' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
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

    @Post('sign-out')
    @ApiOperation({
        summary: 'Sign out',
        description: 'Invalidate current session and clear cookies'
    })
    @ApiResponse({ status: 200, description: 'Successfully signed out' })
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

    @Post('sign-in/social')
    @ApiOperation({
        summary: 'Social authentication',
        description: 'Sign in using Google or other OAuth providers'
    })
    @ApiResponse({ status: 200, description: 'Redirects to OAuth provider' })
    async socialSignIn(
        @Body() body: SocialSignInDto,
        @Res() res: Response,
    ): Promise<void> {
        const response = await auth.api.signInSocial({
            body: {
                provider: body.provider,
                callbackURL: body.callbackURL || "/dashboard"
            },
            asResponse: true,
        });

        res.set(Object.fromEntries(response.headers.entries()));
        const data: unknown = await response.json();
        res.json(data);
    }

    @Post("phone-number/send-otp")
    @ApiOperation({ summary: 'Send OTP to phone', description: 'Triggers an SMS to the provided phone number' })
    async sendOTP(@Body() body: { phoneNumber: string }, @Req() req: Request, @Res() res: Response) {
        const response = await auth.api.sendPhoneNumberOTP({
            body: { phoneNumber: body.phoneNumber },
            headers: fromNodeHeaders(req.headers)
        });
        res.json(response);
    }

    @Post("phone-number/verify")
    @ApiOperation({ summary: 'Verify OTP and Login', description: 'Authenticates a user using phone and OTP' })
    async phoneSignIn(@Body() body: { phoneNumber: string; code: string }, @Req() req: Request, @Res() res: Response) {
        const response = await auth.api.verifyPhoneNumber({
            body: {
                phoneNumber: body.phoneNumber,
                code: body.code
            },
            asResponse: true,
            headers: fromNodeHeaders(req.headers)
        });

        res.set(Object.fromEntries(response.headers.entries()));
        const data = await response.json();
        res.json(data);
    }

    @Get('*')
    @ApiOperation({
        summary: 'Auth handler',
        description: 'Handles OAuth callbacks and other GET-based auth flows'
    })
    async handleGetRoutes(
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        // toNodeHandler directly handles the response stream
        await toNodeHandler(auth)(req, res);
    }
}