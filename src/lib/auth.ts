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

    plugins: [expo(),
        phoneNumber({
            sendOTP: async ({ phoneNumber, code }) => {
                // ⚡ INTEGRATION POINT: 
                // Call your SMS gateway (Twilio/etc.) here to send the 'otp' 
                // to the 'phoneNumber'.
                console.log(`Sending OTP ${code} to ${phoneNumber}`);
            },
        }),
    ],

    trustedOrigins: ["food-delivery-customer://"],

    // security : prevent users from settign their own role

    user: {
        additionalFields: {
            role: {
                type: "string",
                required: true,
                defaultValue: "CUSTOMER",
                // prevent users from changing their role
                input: false,
            }
        }
    }
})