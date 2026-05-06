import "dotenv/config"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { PrismaClient } from "@prisma/client"
import adapter from "./db-connection"
import { expo } from "@better-auth/expo"
import { phoneNumber } from "better-auth/plugins"
import { bearer } from "better-auth/plugins"
import type { CommunicationsService } from "../communications/communications.service"

// ── Injected by AuthModule.onModuleInit() ──────────────────────────────────────
let communicationsService: CommunicationsService | null = null;
export function setCommunicationsService(svc: CommunicationsService) {
    communicationsService = svc;
}

const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql"
    }),
    secret: process.env.BETTER_AUTH_SECRET,

    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            prompt: "select_account"
        }
    },

    emailAndPassword: {
        enabled: true,
    },

    // ⚡ DATABASE HOOKS: Ensures a referral code is generated for EVERY signup method
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    const namePart = user.name ? user.name.split(' ')[0].toUpperCase() : 'USER';
                    const randomPart = Math.floor(1000 + Math.random() * 9000);

                    // Strip the fake placeholder email generated for phone-only signups
                    const isPhonePlaceholder = user.email?.endsWith('@phone.foodapp.local');

                    return {
                        data: {
                            ...user,
                            // Null out the fake email so phone users have no email stored
                            email: isPhonePlaceholder ? undefined : user.email,
                            // Generate referral code if missing
                            referralCode: user.referralCode
                                ? user.referralCode
                                : `${namePart}${randomPart}`,
                        },
                    };
                },
                after: async (user) => {
                    // 📧 Send Welcome Email to new users with a real email
                    if (communicationsService && user.email && !user.email.endsWith('@phone.foodapp.local')) {
                        communicationsService.queueEmail({
                            to: user.email,
                            subject: 'Welcome to FoodApp! 🎉',
                            template: 'welcome',
                            event: 'WELCOME_EMAIL',
                            userId: user.id,
                            templateData: {
                                userName: user.name || 'there',
                                appName: 'FoodApp',
                                appUrl: process.env.CUSTOMER_APP_ORIGIN || '#',
                            },
                        }).catch((e) => console.error(`Failed to queue welcome email: ${e}`));
                    }
                },
            },
        },
    },

    plugins: [
        bearer(),   // ← enables Authorization: Bearer <token> for admin web app
        expo(),
        phoneNumber({
            // ⚡ INTEGRATION POINT: uses CommunicationsService when available
            sendOTP: async ({ phoneNumber: phone, code }) => {
                if (communicationsService) {
                    await communicationsService.queueSms({
                        to: phone,
                        message: `Your OTP is ${code}. Valid for 5 minutes.`,
                        event: 'OTP_VERIFICATION',
                        templateData: { code },
                    });
                } else {
                    // Fallback during early startup / tests
                    console.log(`[sendOTP] ${phone} → ${code}`);
                }
            },

            signUpOnVerification: {
                // Required by Better Auth's type — nullified in databaseHooks before DB write
                getTempEmail: (phone) =>
                    `${phone.replace(/\D/g, "")}@phone.foodapp.local`,
                getTempName: (phone) => `User ${phone.slice(-4)}`,
            },

            otpLength: 6,          // match the 6-digit OTP you're sending
            expiresIn: 300,        // OTP valid for 5 minutes
        }),
    ],

    trustedOrigins: ["food-delivery-customer://", "fooddeliveryrestaurant://", "fooddeliverydriver://", "food-delivery-driver://", "food-delivery-restaurant://", "http://localhost:3000"],
    
    session: {
        additionalFields: {
            pushToken: {
                type: "string",
                required: false,
            },
        },
    },

    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: "CUSTOMER",
                input: false, // prevent users from setting their own role
            },

            referralCode: {
                type: "string",
                required: false // Handled by databaseHooks if missing
            },

            referredById: {
                type: "string",
                required: false
            }
        }
    }
})