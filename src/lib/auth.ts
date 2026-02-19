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
        // ⚡ INTEGRATION POINT: Replace console.log with your real SMS gateway
        sendOTP: async ({ phoneNumber, code }) => {
            console.log(`Sending OTP ${code} to ${phoneNumber}`);
        },

        // Auto-create a user + return a session after OTP is verified.
        // Without this, verify only marks the phone as verified but never
        // creates a session for new users.
        signUpOnVerification: {
            // better-auth requires an email on the user model; derive a
            // placeholder so phone-only sign-ups work out of the box.
            getTempEmail: (phoneNumber) =>
                `${phoneNumber.replace(/\D/g, "")}@phone.foodapp.local`,
            getTempName: (phoneNumber) => phoneNumber,
        },

        otpLength: 6,          // match the 6-digit OTP you're sending
        expiresIn: 300,        // OTP valid for 5 minutes
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