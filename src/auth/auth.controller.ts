import { Controller, Post, Get, Body, Req, Res } from '@nestjs/common';
import { auth } from "../lib/auth";
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import type { Request, Response } from 'express';
import { SignUpDto, SignInDto, SocialSignInDto } from './dto/auth.dto';

@Controller('/api/auth')
export class AuthController {

    @Post("sign-up/email")
    async signUp(
        @Body() body: SignUpDto,
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> { // Change: Use void because we use res.json()
        const response = await auth.api.signUpEmail({
            body: { ...body },
            headers: fromNodeHeaders(req.headers)
        });
        res.json(response);
    }

    @Post('sign-in/email')
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

    @Get('*')
    async handleGetRoutes(
        @Req() req: Request,
        @Res() res: Response
    ): Promise<void> {
        // toNodeHandler directly handles the response stream
        await toNodeHandler(auth)(req, res);
    }
}