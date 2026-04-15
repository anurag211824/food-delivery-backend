import "dotenv/config"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { PrismaClient } from "@prisma/client"
import adapter from "./db-connection"
import { expo } from "@better-auth/expo"
import { phoneNumber } from "better-auth/plugins"

const prisma = new PrismaClient({ adapter });

// Global reference to communications service (set during module initialization)
let communicationsService: any = null;

export function setCommunicationsService(service: any) {
  communicationsService = service;
}

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
            },
        },
    },

    plugins: [
        expo(),
        phoneNumber({
            // ⚡ INTEGRATION POINT: Queue OTP via communications layer
            sendOTP: async ({ phoneNumber, code }) => {
                if (communicationsService) {
                    try {
                        await communicationsService.queueSms({
                            to: phoneNumber,
                            message: `Your FoodApp verification code is: ${code}. Valid for 5 minutes.`,
                            event: 'LOGIN_OTP',
                            templateData: { code, appName: 'FoodApp' },
                        });
                    } catch (error) {
                        console.error(`Failed to queue OTP SMS: ${error}`);
                        // Fallback to console log for debugging
                        console.log(`[FALLBACK] OTP for ${phoneNumber}: ${code}`);
                    }
                } else {
                    // Fallback: service not yet initialized
                    console.log(`[NO SERVICE] OTP for ${phoneNumber}: ${code}`);
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

    trustedOrigins: ["food-delivery-customer://", "fooddeliveryrestaurant://", "fooddeliverydriver://", "food-delivery-driver://", "food-delivery-restaurant://"],
    
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