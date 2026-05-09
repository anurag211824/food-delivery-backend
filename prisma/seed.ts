import { PrismaClient, Role, VegType } from '@prisma/client';
import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('--- Cleaning Database ---');
    await prisma.orderItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.review.deleteMany();
    await prisma.order.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.menuCategory.deleteMany();
    await prisma.restaurant.deleteMany();
    // Delete managers created by seed (careful not to delete your own admin user, we filter by role)
    await prisma.user.deleteMany({ where: { role: Role.RESTAURANT_MANAGER } });
    await prisma.cuisine.deleteMany();
    await prisma.recentSearch.deleteMany();

    console.log('--- Seeding Users (Managers) ---');
    // Using random IDs or generic names
    const managers: any[] = [];
    for (let i = 1; i <= 6; i++) {
        const mgr = await prisma.user.create({
            data: {
                name: `Manager ${i}`,
                email: `manager${i}@test.com`,
                role: Role.RESTAURANT_MANAGER,
                referralCode: `MGR${i}${Math.floor(1000 + Math.random() * 9000)}`
            },
        });
        managers.push(mgr);
    }

    console.log('--- Seeding Restaurants ---');
    // User Location: 30.3404, 78.0507
    // 1 deg Lat approx 111km. 1 deg Lng approx 96km (at lat 30).
    const restaurantData = [
        {
            name: "Pizza Paradise (2km North)",
            description: "Best wood-fired pizzas in town. Very close to you.",
            costForTwo: 500,
            cuisineTypes: ["Italian", "Pizza"],
            address: "2km North St",
            lat: 30.3584,
            lng: 78.0507,
            managerId: managers[0].id,
            rating: 4.5,
            image: "https://images.unsplash.com/photo-1544982503-9f984c14501a?w=800&q=80"
        },
        {
            name: "Burger Haven (4km East)",
            description: "Juicy burgers and crispy fries.",
            costForTwo: 400,
            cuisineTypes: ["American", "Fast Food"],
            address: "4km East Avenue",
            lat: 30.3404,
            lng: 78.0923,
            managerId: managers[1].id,
            rating: 4.2,
            image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80"
        },
        {
            name: "Curry House (6km South)",
            description: "Authentic Indian curries and spices.",
            costForTwo: 600,
            cuisineTypes: ["North Indian", "Mughlai"],
            address: "6km South Road",
            lat: 30.2864,
            lng: 78.0507,
            managerId: managers[2].id,
            rating: 4.7,
            image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80"
        },
        {
            name: "Dimsum Delight (7.5km West - SHOULD BE FILTERED OUT)",
            description: "Delicious momos and dimsums.",
            costForTwo: 300,
            cuisineTypes: ["Chinese", "Asian"],
            address: "7.5km West Lane",
            lat: 30.3404,
            lng: 77.9726,
            managerId: managers[3].id,
            rating: 4.1,
            image: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=800&q=80"
        },
        {
            name: "Taco Fiesta (9km North - SHOULD BE FILTERED OUT)",
            description: "Mexican street food and tacos.",
            costForTwo: 450,
            cuisineTypes: ["Mexican", "Street Food"],
            address: "9km North Blvd",
            lat: 30.4214,
            lng: 78.0507,
            managerId: managers[4].id,
            rating: 4.6,
            image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80"
        },
        {
            name: "Sushi Station (3km South)",
            description: "Fresh sushi and Japanese cuisine.",
            costForTwo: 800,
            cuisineTypes: ["Japanese", "Sushi"],
            address: "3km South St",
            lat: 30.3134,
            lng: 78.0507,
            managerId: managers[5].id,
            rating: 4.8,
            image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80"
        }
    ];

    const restaurantRecords: any[] = [];
    for (const data of restaurantData) {
        const res = await prisma.restaurant.create({
            data: {
                ...data,
                isActive: true,
                isOpen: true,
                isVerified: true
            }
        });
        restaurantRecords.push(res);
    }

    console.log('--- Seeding Categories and Items ---');
    for (const res of restaurantRecords) {

        let categories = [];
        let items: any[] = [];

        // 1. Pizza Paradise
        if (res.name.includes("Pizza Paradise")) {
            const pizzaCat = await prisma.menuCategory.create({ data: { name: 'Wood-Fired Pizzas', restaurantId: res.id } });
            const sidesCat = await prisma.menuCategory.create({ data: { name: 'Sides & Breads', restaurantId: res.id } });
            items.push(
                { name: 'Margherita Pizza', price: 299, type: VegType.VEG, categoryId: pizzaCat.id, isBestseller: true, description: 'Classic mozzarella and basil', prepTime: 20, image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80" },
                { name: 'Pepperoni Pizza', price: 450, type: VegType.NON_VEG, categoryId: pizzaCat.id, isBestseller: true, description: 'Spicy pepperoni slices', prepTime: 20, image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=500&q=80" },
                { name: 'Farmhouse Pizza', price: 399, type: VegType.VEG, categoryId: pizzaCat.id, isBestseller: false, description: 'Onion, capsicum, mushroom, tomato', prepTime: 20, image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80" },
                { name: 'Garlic Breadsticks', price: 149, type: VegType.VEG, categoryId: sidesCat.id, isBestseller: true, description: 'Freshly baked with garlic butter', prepTime: 10, image: "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=500&q=80" },
                { name: 'Cheese Dip', price: 49, type: VegType.VEG, categoryId: sidesCat.id, isBestseller: false, description: 'Jalapeno cheese dip', prepTime: 0, image: "https://images.unsplash.com/photo-1596662951482-0c4ba74a6df6?w=500&q=80" }
            );
        }

        // 2. Burger Haven
        else if (res.name.includes("Burger Haven")) {
            const burgerCat = await prisma.menuCategory.create({ data: { name: 'Gourmet Burgers', restaurantId: res.id } });
            const mealCat = await prisma.menuCategory.create({ data: { name: 'Value Meals', restaurantId: res.id } });
            items.push(
                { name: 'Classic Veg Burger', price: 199, type: VegType.VEG, categoryId: burgerCat.id, isBestseller: true, description: 'Crispy veggie patty with house sauce', prepTime: 15, image: "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=500&q=80" },
                { name: 'Double Chicken Burger', price: 299, type: VegType.NON_VEG, categoryId: burgerCat.id, isBestseller: true, description: 'Two juicy grilled chicken patties', prepTime: 15, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80" },
                { name: 'Spicy Paneer Burger', price: 220, type: VegType.VEG, categoryId: burgerCat.id, isBestseller: false, description: 'Spicy peri-peri paneer patty', prepTime: 15, image: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80" },
                { name: 'Chicken Meal (Burger + Fries + Coke)', price: 399, type: VegType.NON_VEG, categoryId: mealCat.id, isBestseller: true, description: 'Save 20% on the combo', prepTime: 20, image: "https://images.unsplash.com/photo-1594212691516-435fa51fa877?w=500&q=80" }
            );
        }

        // 3. Curry House
        else if (res.name.includes("Curry House")) {
            const mainsCat = await prisma.menuCategory.create({ data: { name: 'Main Course', restaurantId: res.id } });
            const breadsCat = await prisma.menuCategory.create({ data: { name: 'Indian Breads', restaurantId: res.id } });
            items.push(
                { name: 'Butter Chicken', price: 380, type: VegType.NON_VEG, categoryId: mainsCat.id, isBestseller: true, description: 'Rich tomato gravy with cream', prepTime: 25, image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&q=80" },
                { name: 'Paneer Butter Masala', price: 320, type: VegType.VEG, categoryId: mainsCat.id, isBestseller: true, description: 'Cottage cheese in rich gravy', prepTime: 25, image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&q=80" },
                { name: 'Dal Makhani', price: 250, type: VegType.VEG, categoryId: mainsCat.id, isBestseller: false, description: 'Slow cooked black lentils', prepTime: 20, image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80" },
                { name: 'Garlic Naan', price: 60, type: VegType.VEG, categoryId: breadsCat.id, isBestseller: true, description: 'Tandoori bread with garlic', prepTime: 10, image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&q=80" },
                { name: 'Butter Roti', price: 30, type: VegType.VEG, categoryId: breadsCat.id, isBestseller: false, description: 'Whole wheat bread', prepTime: 5, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&q=80" }
            );
        }

        // 4. Dimsum Delight
        else if (res.name.includes("Dimsum Delight")) {
            const momoCat = await prisma.menuCategory.create({ data: { name: 'Steamed Momos', restaurantId: res.id } });
            const wokCat = await prisma.menuCategory.create({ data: { name: 'Wok Specials', restaurantId: res.id } });
            items.push(
                { name: 'Veg Kurkure Momos', price: 180, type: VegType.VEG, categoryId: momoCat.id, isBestseller: true, description: '8 pcs, crispy fried', prepTime: 20, image: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=500&q=80" },
                { name: 'Chicken Steamed Momos', price: 150, type: VegType.NON_VEG, categoryId: momoCat.id, isBestseller: true, description: '8 pcs, traditional style', prepTime: 15, image: "https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=500&q=80" },
                { name: 'Veg Hakka Noodles', price: 200, type: VegType.VEG, categoryId: wokCat.id, isBestseller: false, description: 'Street-style wok tossed', prepTime: 15, image: "https://images.unsplash.com/photo-1626804475297-41609ea0ec4c?w=500&q=80" }
            );
        }

        // 5. Taco Fiesta
        else if (res.name.includes("Taco Fiesta")) {
            const tacoCat = await prisma.menuCategory.create({ data: { name: 'Tacos & Quesadillas', restaurantId: res.id } });
            items.push(
                { name: 'Crunchy Bean Taco', price: 120, type: VegType.VEG, categoryId: tacoCat.id, isBestseller: true, description: 'Refried beans and cheese', prepTime: 10, image: "https://images.unsplash.com/photo-1564767609342-620cb19b2357?w=500&q=80" },
                { name: 'Grilled Chicken Quesadilla', price: 250, type: VegType.NON_VEG, categoryId: tacoCat.id, isBestseller: true, description: 'Stuffed with cheese and fajita veggies', prepTime: 15, image: "https://images.unsplash.com/photo-1618040775215-eb1287ca3ec2?w=500&q=80" },
                { name: 'Loaded Nachos', price: 200, type: VegType.VEG, categoryId: tacoCat.id, isBestseller: false, description: 'Salsa, sour cream, and jalapenos', prepTime: 10, image: "https://images.unsplash.com/photo-1582169505937-b9992bd01ed9?w=500&q=80" }
            );
        }

        // 6. Sushi Station
        else if (res.name.includes("Sushi Station")) {
            const sushiCat = await prisma.menuCategory.create({ data: { name: 'Sushi Rolls (8 pcs)', restaurantId: res.id } });
            const bowlCat = await prisma.menuCategory.create({ data: { name: 'Ramen & Bowls', restaurantId: res.id } });
            items.push(
                { name: 'California Roll', price: 600, type: VegType.NON_VEG, categoryId: sushiCat.id, isBestseller: true, description: 'Crab, avocado, cucumber', prepTime: 25, image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&q=80" },
                { name: 'Spicy Tuna Roll', price: 750, type: VegType.NON_VEG, categoryId: sushiCat.id, isBestseller: true, description: 'Fresh tuna with spicy mayo', prepTime: 25, image: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=500&q=80" },
                { name: 'Veg Tempura Roll', price: 450, type: VegType.VEG, categoryId: sushiCat.id, isBestseller: false, description: 'Crispy fried veggies inside', prepTime: 25, image: "https://images.unsplash.com/photo-1580822184713-3637c35e9854?w=500&q=80" },
                { name: 'Pork Chashu Ramen', price: 850, type: VegType.NON_VEG, categoryId: bowlCat.id, isBestseller: true, description: 'Tonkotsu broth with marinated pork', prepTime: 30, image: "https://images.unsplash.com/photo-1557872943-16a5ac26437e?w=500&q=80" }
            );
        }

        // Failsafe for any extra restaurants
        else {
            const miscCat = await prisma.menuCategory.create({ data: { name: 'Specials', restaurantId: res.id } });
            items.push({ name: `${res.name} Special`, price: 250, type: VegType.VEG, categoryId: miscCat.id, isBestseller: true, description: 'House favorite', prepTime: 20, image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&q=80" });
        }

        // Insert the items in bulk
        if (items.length > 0) {
            await prisma.menuItem.createMany({ data: items });
        }
    }

    console.log('--- Seeding Cuisines (What\'s on your mind) ---');
    const cuisines = [
        { name: "Pizza", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80" },
        { name: "North Indian", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80" },
        { name: "Veg Meal", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80" },
        { name: "Burger", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80" },
        { name: "Biryani", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80" },
        { name: "Rolls", image: "https://images.unsplash.com/photo-1594179047519-f347310d3322?w=400&q=80" },
        { name: "Chinese", image: "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400&q=80" },
        { name: "Momo", image: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=400&q=80" },
        { name: "Paneer", image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=400&q=80" },
        { name: "Thali", image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&q=80" },
        { name: "Cake", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80" },
        { name: "Desserts", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&q=80" },
        { name: "Chole Bhature", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80" },
        { name: "Sweets", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80" },
    ];

    for (const cuisine of cuisines) {
        await prisma.cuisine.create({
            data: {
                ...cuisine,
                isActive: true
            }
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