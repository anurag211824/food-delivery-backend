import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import  prismaAdapter from "../lib/db-connection";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {

    constructor() {
        super({ adapter: prismaAdapter });
    }

    async onModuleInit(): Promise<void> {
        // Connect via the shared pool
        await this.$connect();
    }

    async onModuleDestroy(): Promise<void> {
        // Disconnect Prisma from the adapter
        await this.$disconnect();
    }
}