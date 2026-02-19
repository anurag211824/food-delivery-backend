import "dotenv/config"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { PrismaClient } from "@prisma/client"
import adapter from "./db-connection"
import { expo } from "@better-auth/expo"
import { phoneNumber } from "better-auth/plugins"

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
                    // Automatically generate a code if it's missing (e.g., Phone or Google signups)
                    if (!user.referralCode) {
                        const namePart = user.name ? user.name.split(' ')[0].toUpperCase() : 'USER';
                        const randomPart = Math.floor(1000 + Math.random() * 9000);
                        return {
                            data: {
                                ...user,
                                referralCode: `${namePart}${randomPart}`,
                            },
                        };
                    }
                },
            },
        },
    },

    plugins: [
        expo(),
        phoneNumber({
            // ⚡ INTEGRATION POINT: Replace console.log with your real SMS gateway
            sendOTP: async ({ phoneNumber, code }) => {
                console.log(`Sending OTP ${code} to ${phoneNumber}`);
            },

            signUpOnVerification: {
                // better-auth requires an email on the user model; derive a
                // placeholder so phone-only sign-ups work out of the box.
                getTempEmail: (phone) =>
                    `${phone.replace(/\D/g, "")}@phone.foodapp.local`,
                getTempName: (phone) => `User ${phone.slice(-4)}`,
            },

            otpLength: 6,          // match the 6-digit OTP you're sending
            expiresIn: 300,        // OTP valid for 5 minutes
        }),
    ],

    trustedOrigins: ["food-delivery-customer://"],

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