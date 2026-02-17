import { PrismaClient, Role, VegType } from '@prisma/client';
import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 1. Manually load the .env file
dotenv.config();

// 2. Create a PostgreSQL pool and adapter for Prisma 7
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('--- Cleaning Database ---');
    // Order matters here to avoid foreign key conflicts
    await prisma.menuItem.deleteMany();
    await prisma.menuCategory.deleteMany();
    await prisma.restaurant.deleteMany();
    await prisma.user.deleteMany();

    console.log('--- Seeding Users (Managers) ---');
    const managers = await Promise.all([
        prisma.user.create({
            data: {
                name: 'Amit Negi',
                email: 'amit@doonkitchen.com',
                role: Role.RESTAURANT_MANAGER,
            },
        }),
        prisma.user.create({
            data: {
                name: 'Sonia Rawat',
                email: 'sonia@pahadigrill.com',
                role: Role.RESTAURANT_MANAGER,
            },
        }),
        prisma.user.create({
            data: {
                name: 'Rahul Singh',
                email: 'rahul@burgerhub.com',
                role: Role.RESTAURANT_MANAGER,
            },
        }),
    ]);

    console.log('--- Seeding Restaurants ---');
    const restaurants = await Promise.all([
        prisma.restaurant.create({
            data: {
                name: 'The Doon Kitchen',
                description: 'Authentic Garhwali & North Indian Flavors',
                costForTwo: 600,
                cuisineTypes: ['North Indian', 'Pahadi'],
                address: 'Rajpur Road, Dehradun',
                lat: 30.3165,
                lng: 78.0322,
                managerId: managers[0].id,
            },
        }),
        prisma.restaurant.create({
            data: {
                name: 'Pahadi Grill',
                description: 'Traditional Tandoor and Charcoal Grills',
                costForTwo: 800,
                cuisineTypes: ['Tandoori', 'Indian'],
                address: 'Mussoorie Diversion, Dehradun',
                lat: 30.3667,
                lng: 78.0750,
                managerId: managers[1].id,
            },
        }),
        prisma.restaurant.create({
            data: {
                name: 'The Burger Hub',
                description: 'Juicy burgers and thick shakes',
                costForTwo: 400,
                cuisineTypes: ['American', 'Fast Food'],
                address: 'Indira Nagar, Dehradun',
                lat: 30.3341,
                lng: 77.9942,
                managerId: managers[2].id,
            },
        }),
    ]);

    console.log('--- Seeding Categories and Items ---');
    for (const res of restaurants) {
        // Create Categories
        const recommended = await prisma.menuCategory.create({
            data: { name: 'Recommended', restaurantId: res.id },
        });
        const mainCourse = await prisma.menuCategory.create({
            data: { name: 'Main Course', restaurantId: res.id },
        });

        // Create Items for Recommended
        await prisma.menuItem.createMany({
            data: [
                {
                    name: `${res.name} Special Platter`,
                    price: 450,
                    type: VegType.NON_VEG,
                    categoryId: recommended.id,
                    isBestseller: true,
                    description: 'Chef signature selection',
                },
                {
                    name: 'Paneer Tikka',
                    price: 280,
                    type: VegType.VEG,
                    categoryId: recommended.id,
                    description: 'Fresh malai paneer',
                },
            ],
        });

        // Create Items for Main Course
        await prisma.menuItem.createMany({
            data: [
                {
                    name: 'Dal Makhani',
                    price: 220,
                    type: VegType.VEG,
                    categoryId: mainCourse.id,
                    prepTime: 20,
                },
                {
                    name: 'Butter Chicken',
                    price: 380,
                    type: VegType.NON_VEG,
                    categoryId: mainCourse.id,
                    prepTime: 25,
                },
            ],
        });
    }

    console.log('--- Seeding Complete! ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });