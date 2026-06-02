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
    await prisma.orderItemAddon.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.review.deleteMany();
    await prisma.order.deleteMany();
    await prisma.addonOption.deleteMany();
    await prisma.addonGroup.deleteMany();
    await prisma.menuVariant.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.menuCategory.deleteMany();
    await prisma.restaurant.deleteMany();
    // Delete managers created by seed (careful not to delete your own admin user, we filter by role)
    await prisma.user.deleteMany({ where: { role: Role.RESTAURANT_MANAGER } });
    await prisma.cuisine.deleteMany();
    await prisma.recentSearch.deleteMany();

    console.log('--- Seeding Users (Managers) ---');
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

    console.log('--- Seeding Indian Restaurants ---');
    // User Location: 30.3404, 78.0507
    const restaurantData = [
        {
            name: "Laziz Pizza & Tandoori Junction (2km North)",
            description: "Delicious fusion pizzas and hot clay-oven starters.",
            costForTwo: 450,
            cuisineTypes: ["Italian", "Pizza", "North Indian"],
            address: "Rajpur Road, Near Jakhan, Dehradun",
            lat: 30.3584,
            lng: 78.0507,
            managerId: managers[0].id,
            rating: 4.6,
            image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80"
        },
        {
            name: "Chai Tapri & Bun Samosa Café (4km East)",
            description: "Adrak Chai, Bun Makkhan, crispy Samosas, and Indian street burgers.",
            costForTwo: 200,
            cuisineTypes: ["Fast Food", "Street Food", "Tea"],
            address: "Dharampur Chowk, Nehru Colony, Dehradun",
            lat: 30.3404,
            lng: 78.0923,
            managerId: managers[1].id,
            rating: 4.4,
            image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80"
        },
        {
            name: "Pind Da Dhaba - Authentic Punjabi (6km South)",
            description: "Pure Punjabi flavors with rich butter-laden gravies and direct tandoor rotis.",
            costForTwo: 550,
            cuisineTypes: ["North Indian", "Punjabi", "Mughlai"],
            address: "ISBT Road, Patel Nagar, Dehradun",
            lat: 30.2864,
            lng: 78.0507,
            managerId: managers[2].id,
            rating: 4.8,
            image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80"
        },
        {
            name: "Momo Station & Chinese Corner (7.5km West)",
            description: "Steamed, Fried, and Tandoori Momos alongside spicy Hakka noodles.",
            costForTwo: 300,
            cuisineTypes: ["Chinese", "Momo", "Asian"],
            address: "Prem Nagar Market, Dehradun",
            lat: 30.3404,
            lng: 77.9726,
            managerId: managers[3].id,
            rating: 4.2,
            image: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=800&q=80"
        },
        {
            name: "Shree Balaji Mithai & Chaat Bhandar (9km North)",
            description: "Traditional Indian sweets, Desi Ghee Jalebi, and spicy Samosa Chaat.",
            costForTwo: 250,
            cuisineTypes: ["Sweets", "Chaat", "Street Food"],
            address: "Mussoorie Road, Dehradun",
            lat: 30.4214,
            lng: 78.0507,
            managerId: managers[4].id,
            rating: 4.7,
            image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=800&q=80"
        },
        {
            name: "Royal Biryani & Kebab Darbar (3km South)",
            description: "World famous Hyderabadi & Lucknowi Dum Biryanis served with fresh raita.",
            costForTwo: 500,
            cuisineTypes: ["Biryani", "Mughlai", "North Indian"],
            address: "Arhat Bazar, Saharanpur Road, Dehradun",
            lat: 30.3134,
            lng: 78.0507,
            managerId: managers[5].id,
            rating: 4.9,
            image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=800&q=80"
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
        let cat1, cat2;

        if (res.name.includes("Laziz Pizza")) {
            cat1 = await prisma.menuCategory.create({ data: { name: 'Desi Fusion Pizzas', restaurantId: res.id } });
            cat2 = await prisma.menuCategory.create({ data: { name: 'Appetizers & Sides', restaurantId: res.id } });

            // 1. Paneer Tikka Pizza
            await createMenuItem(cat1.id, {
                name: 'Tandoori Paneer Tikka Pizza',
                description: 'Cottage cheese marinated in Indian spices, capsicum, red onion, and mozzarella.',
                type: VegType.VEG,
                isBestseller: true,
                prepTime: 20,
                image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&q=80",
                variants: [
                    { name: 'Regular Size (Personal)', price: 249, isDefault: true },
                    { name: 'Medium Size (Serves 2)', price: 399 },
                    { name: 'Large Size (Serves 4)', price: 549 }
                ],
                addons: [
                    {
                        name: 'Select Crust Type',
                        minSelect: 1,
                        maxSelect: 1,
                        options: [
                            { name: 'Pan Crust', price: 0 },
                            { name: 'Cheese Burst Crust', price: 90 },
                            { name: 'Wheat Thin Crust', price: 30 }
                        ]
                    },
                    {
                        name: 'Add Extra Toppings',
                        minSelect: 0,
                        maxSelect: 4,
                        options: [
                            { name: 'Extra Paneer Cubes', price: 60 },
                            { name: 'Extra Mozzarella Cheese', price: 70 },
                            { name: 'Jalapenos', price: 40 },
                            { name: 'Spicy Green Chillies', price: 15 }
                        ]
                    }
                ]
            });

            // 2. Garlic Breadsticks
            await createMenuItem(cat2.id, {
                name: 'Garlic Breadsticks with Cheese',
                description: 'Baked to perfection with garlic butter and rich mozzarella.',
                type: VegType.VEG,
                isBestseller: true,
                prepTime: 12,
                image: "https://images.unsplash.com/photo-1573140247632-f8fd74997d5c?w=500&q=80",
                variants: [
                    { name: 'Default', price: 139, isDefault: true }
                ],
                addons: [
                    {
                        name: 'Add Creamy Cheese Dip',
                        minSelect: 0,
                        maxSelect: 1,
                        options: [
                            { name: 'Jalapeno Cheese Dip', price: 29 },
                            { name: 'Classic Cheesy Dip', price: 25 }
                        ]
                    }
                ]
            });

        } else if (res.name.includes("Chai Tapri")) {
            cat1 = await prisma.menuCategory.create({ data: { name: 'Tapri Specials', restaurantId: res.id } });
            cat2 = await prisma.menuCategory.create({ data: { name: 'Snacks & Buns', restaurantId: res.id } });

            // 1. Adrak Chai
            await createMenuItem(cat1.id, {
                name: 'Special Adrak Elaichi Tea',
                description: 'Freshly brewed loose-leaf milk tea infused with hand-crushed ginger and green cardamom.',
                type: VegType.VEG,
                isBestseller: true,
                prepTime: 10,
                image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500&q=80",
                variants: [
                    { name: 'Cutting Chai (1 Small Cup)', price: 20, isDefault: true },
                    { name: 'Full Cup (Standard)', price: 35 },
                    { name: 'Kullhad Special (Clay Pot)', price: 45 }
                ],
                addons: []
            });

            // 2. Aloo Tikki Burger
            await createMenuItem(cat2.id, {
                name: 'Desi Aloo Tikki Burger',
                description: 'Crispy potato patty topped with sweet tamarind chutney, spicy mint sauce, and onion slices.',
                type: VegType.VEG,
                isBestseller: true,
                prepTime: 10,
                image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80",
                variants: [
                    { name: 'Single Patty Burger', price: 79, isDefault: true },
                    { name: 'Double Patty Burger', price: 119 }
                ],
                addons: [
                    {
                        name: 'Extras',
                        minSelect: 0,
                        maxSelect: 2,
                        options: [
                            { name: 'Amul Cheese Slice', price: 15 },
                            { name: 'Extra Burger Sauce', price: 10 }
                        ]
                    }
                ]
            });

        } else if (res.name.includes("Pind Da Dhaba")) {
            cat1 = await prisma.menuCategory.create({ data: { name: 'Punjabi Main Gravies', restaurantId: res.id } });
            cat2 = await prisma.menuCategory.create({ data: { name: 'Fresh Clay Oven Breads', restaurantId: res.id } });

            // 1. Butter Chicken
            await createMenuItem(cat1.id, {
                name: 'Murg Makhani (Butter Chicken)',
                description: 'Tandoori-grilled chicken pieces cooked in a rich, buttery, creamy tomato gravy.',
                type: VegType.NON_VEG,
                isBestseller: true,
                prepTime: 25,
                image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&q=80",
                variants: [
                    { name: 'Half Handi (Serves 1-2)', price: 340, isDefault: true },
                    { name: 'Full Handi (Serves 3-4)', price: 580 }
                ],
                addons: [
                    {
                        name: 'Add Extra Salad/Chutney',
                        minSelect: 0,
                        maxSelect: 2,
                        options: [
                            { name: 'Sirka Pyaz (Vinegar Onions)', price: 20 },
                            { name: 'Extra Mint Green Chutney', price: 10 }
                        ]
                    }
                ]
            });

            // 2. Paneer Butter Masala
            await createMenuItem(cat1.id, {
                name: 'Paneer Butter Masala',
                description: 'Spiced cottage cheese cubes simmered in a luscious, creamy, buttery tomato-onion gravy.',
                type: VegType.VEG,
                isBestseller: true,
                prepTime: 20,
                image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&q=80",
                variants: [
                    { name: 'Half Handi (Serves 1-2)', price: 280, isDefault: true },
                    { name: 'Full Handi (Serves 3-4)', price: 490 }
                ],
                addons: [
                    {
                        name: 'Add extra butter top-up',
                        minSelect: 0,
                        maxSelect: 1,
                        options: [
                            { name: 'Extra Cube of Amul Butter', price: 20 }
                        ]
                    }
                ]
            });

            // 3. Indian Breads
            await createMenuItem(cat2.id, {
                name: 'Tandoor Hot Breads',
                description: 'Fresh wheat flour and all-purpose flour rotis baked live inside clay ovens.',
                type: VegType.VEG,
                isBestseller: false,
                prepTime: 8,
                image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&q=80",
                variants: [
                    { name: 'Tandoori Roti (Wheat)', price: 20, isDefault: true },
                    { name: 'Butter Roti (Wheat)', price: 25 },
                    { name: 'Plain Naan (Maida)', price: 40 },
                    { name: 'Butter Naan (Maida)', price: 50 },
                    { name: 'Garlic Naan (Maida)', price: 65 },
                    { name: 'Lachha Paratha (Layered)', price: 55 }
                ],
                addons: []
            });

        } else if (res.name.includes("Momo Station")) {
            cat1 = await prisma.menuCategory.create({ data: { name: 'Mouthwatering Momos', restaurantId: res.id } });
            cat2 = await prisma.menuCategory.create({ data: { name: 'Hakka Noodles & Woks', restaurantId: res.id } });

            // 1. Momos
            await createMenuItem(cat1.id, {
                name: 'Paneer & Veg Steamed Momos',
                description: 'Stuffed with fresh minced cabbage, carrot, paneer, and onion. Served with spicy red garlic-chilli dip.',
                type: VegType.VEG,
                isBestseller: true,
                prepTime: 15,
                image: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=500&q=80",
                variants: [
                    { name: 'Half Plate (6 pieces)', price: 90, isDefault: true },
                    { name: 'Full Plate (10 pieces)', price: 150 }
                ],
                addons: [
                    {
                        name: 'Add Extra Dips',
                        minSelect: 0,
                        maxSelect: 2,
                        options: [
                            { name: 'Tandoori Garlic Mayonnaise', price: 15 },
                            { name: 'Extra Spicy Red Chutney', price: 10 }
                        ]
                    }
                ]
            });

        } else if (res.name.includes("Shree Balaji")) {
            cat1 = await prisma.menuCategory.create({ data: { name: 'Desi Chaat Corners', restaurantId: res.id } });
            cat2 = await prisma.menuCategory.create({ data: { name: 'Indian Mithai (Desserts)', restaurantId: res.id } });

            // 1. Golgappe
            await createMenuItem(cat1.id, {
                name: 'Spicy Delhi Golgappe (Puchka)',
                description: '6 pieces of crispy semolina puris served with spicy mint water, sweet tamarind chutney, and a chickpea-potato filling.',
                type: VegType.VEG,
                isBestseller: true,
                prepTime: 5,
                image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80",
                variants: [
                    { name: 'Atta Golgappa (Wheat)', price: 50, isDefault: true },
                    { name: 'Suji Golgappa (Semolina)', price: 60 }
                ],
                addons: [
                    {
                        name: 'Flavor of Spicy Water',
                        minSelect: 1,
                        maxSelect: 2,
                        options: [
                            { name: 'Teekha Pudina (Spicy Mint)', price: 0 },
                            { name: 'Khatta Meetha (Tangy Sweet)', price: 0 }
                        ]
                    }
                ]
            });

            // 2. Kaju Katli
            await createMenuItem(cat2.id, {
                name: 'Premium Cashew Kaju Katli',
                description: 'Rich, smooth fudge made of cashew nuts and sugar syrup, topped with silver leaf.',
                type: VegType.VEG,
                isBestseller: true,
                prepTime: 5,
                image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80",
                variants: [
                    { name: 'Quarter Pack (250 grams)', price: 250, isDefault: true },
                    { name: 'Half Kilogram (500 grams)', price: 480 },
                    { name: 'Full Kilogram (1 kilogram)', price: 900 }
                ],
                addons: []
            });

        } else if (res.name.includes("Royal Biryani")) {
            cat1 = await prisma.menuCategory.create({ data: { name: 'Hyderabadi Dum Biryanis', restaurantId: res.id } });
            cat2 = await prisma.menuCategory.create({ data: { name: 'Starters & Kebabs', restaurantId: res.id } });

            // 1. Chicken Biryani
            await createMenuItem(cat1.id, {
                name: 'Hyderabadi Chicken Dum Biryani',
                description: 'Basmati rice cooked in slow-steam (Dum) with marinated chicken pieces, whole spices, and saffron. Served with Salan & Raita.',
                type: VegType.NON_VEG,
                isBestseller: true,
                prepTime: 25,
                image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&q=80",
                variants: [
                    { name: 'Single Pack (Serves 1, 1 Piece Chicken)', price: 220, isDefault: true },
                    { name: 'Double Pack (Serves 2, 2 Pieces Chicken)', price: 390 },
                    { name: 'Family Handi (Serves 3-4, 4 Pieces Chicken)', price: 690 }
                ],
                addons: [
                    {
                        name: 'Add Extras for Biryani',
                        minSelect: 0,
                        maxSelect: 3,
                        options: [
                            { name: 'Extra Boiled Egg', price: 15 },
                            { name: 'Extra Mirchi Ka Salan (Spicy Gravy)', price: 20 },
                            { name: 'Extra Creamy Raita Cup', price: 25 }
                        ]
                    }
                ]
            });
        }
    }

    console.log('--- Seeding Cuisines (What\'s on your mind) ---');
    const cuisines = [
        { name: "Pizza", image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80" },
        { name: "North Indian", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80" },
        { name: "Tea & Chai", image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80" },
        { name: "Burger", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80" },
        { name: "Biryani", image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&q=80" },
        { name: "Momos", image: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=400&q=80" },
        { name: "Chinese", image: "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400&q=80" },
        { name: "Desserts & Sweets", image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80" },
        { name: "Chaat", image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400&q=80" }
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

/** Helper function to create MenuItem with deep nested variants and addon options */
async function createMenuItem(categoryId: string, item: {
    name: string;
    description: string;
    type: VegType;
    isBestseller: boolean;
    prepTime: number;
    image: string;
    variants: Array<{ name: string; price: number; isDefault?: boolean }>;
    addons: Array<{
        name: string;
        minSelect: number;
        maxSelect: number;
        options: Array<{ name: string; price: number }>;
    }>;
}) {
    await prisma.menuItem.create({
        data: {
            name: item.name,
            description: item.description,
            image: item.image,
            type: item.type,
            spiceLevel: 'Medium',
            isBestseller: item.isBestseller,
            prepTime: item.prepTime,
            categoryId: categoryId,
            variants: {
                create: item.variants.map(v => ({
                    name: v.name,
                    price: v.price,
                    isDefault: v.isDefault ?? false,
                    isAvailable: true
                }))
            },
            addons: {
                create: item.addons.map(g => ({
                    name: g.name,
                    minSelect: g.minSelect,
                    maxSelect: g.maxSelect,
                    options: {
                        create: g.options.map(o => ({
                            name: o.name,
                            price: o.price,
                            isAvailable: true
                        }))
                    }
                }))
            }
        }
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });