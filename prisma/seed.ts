import * as dotenv from 'dotenv';
dotenv.config({ override: true });

import { PrismaClient, Role, VegType, DriverStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { auth } from '../src/lib/auth';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') || process.env.DATABASE_URL?.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : false
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// CSV parsing helper to handle quoted values (like addresses with commas inside quotes)
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// Interfaces for our menu structure templates
interface MenuItemInput {
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
}

interface MenuTemplate {
    cuisineTypes: string[];
    vegType: VegType;
    categories: Array<{
        name: string;
        items: MenuItemInput[];
    }>;
}

// Unique image lists to make all 60 restaurants look distinct and premium
const tibetanLogos = [
    "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&q=80",
    "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=500&q=80",
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80"
];
const tibetanBanners = [
    "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=1000&q=80",
    "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=1000&q=80",
    "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=1000&q=80"
];

const maggiLogos = [
    "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&q=80",
    "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500&q=80",
    "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80"
];
const maggiBanners = [
    "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=1000&q=80",
    "https://images.unsplash.com/photo-1552611052-33e04de081de?w=1000&q=80",
    "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=1000&q=80"
];

const indianVegLogos = [
    "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&q=80",
    "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80",
    "https://images.unsplash.com/photo-1601050690697-2fc5f24c8153?w=500&q=80"
];
const indianVegBanners = [
    "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=1000&q=80",
    "https://images.unsplash.com/photo-1585938338392-50a59970d8ee?w=1000&q=80",
    "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=1000&q=80"
];

const biryaniLogos = [
    "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&q=80",
    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&q=80",
    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500&q=80"
];
const biryaniBanners = [
    "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=1000&q=80",
    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1000&q=80",
    "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=1000&q=80"
];

const cafeLogos = [
    "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&q=80",
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80",
    "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500&q=80"
];
const cafeBanners = [
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000&q=80",
    "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=1000&q=80",
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1000&q=80"
];

const resortLogos = [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80",
    "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&q=80",
    "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&q=80"
];
const resortBanners = [
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1000&q=80",
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1000&q=80"
];

const sweetsLogos = [
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&q=80",
    "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&q=80",
    "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500&q=80"
];
const sweetsBanners = [
    "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=1000&q=80",
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1000&q=80",
    "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=1000&q=80"
];

const dhabaLogos = [
    "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80",
    "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&q=80",
    "https://images.unsplash.com/photo-1603133872878-6966b46880a0?w=500&q=80"
];
const dhabaBanners = [
    "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=1000&q=80",
    "https://images.unsplash.com/photo-1585938338392-50a59970d8ee?w=1000&q=80",
    "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=1000&q=80"
];

// 1. Tibetan & Chinese (Lhasa/Momo) Template
const TibetanTemplate: MenuTemplate = {
    cuisineTypes: ["Tibetan", "Chinese", "Momos"],
    vegType: VegType.NON_VEG,
    categories: [
        {
            name: "Tibetan Specialties",
            items: [
                {
                    name: "Lhasa Special Thenthuk",
                    description: "Authentic hand-pulled flat noodle soup with fresh vegetables and aromatic Tibetan herbs.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 15,
                    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&q=80",
                    variants: [
                        { name: "Veg Portion", price: 160, isDefault: true },
                        { name: "Chicken Portion", price: 210 }
                    ],
                    addons: []
                },
                {
                    name: "Veg Thukpa",
                    description: "Traditional noodle soup with seasonal greens and ginger garlic broth.",
                    type: VegType.VEG,
                    isBestseller: false,
                    prepTime: 12,
                    image: "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=500&q=80",
                    variants: [
                        { name: "Standard Bowl", price: 140, isDefault: true }
                    ],
                    addons: []
                }
            ]
        },
        {
            name: "Authentic Momos",
            items: [
                {
                    name: "Chicken Kothey Momos",
                    description: "Pan-fried Himalayan dumplings filled with seasoned minced chicken, served with spicy red chutney.",
                    type: VegType.NON_VEG,
                    isBestseller: true,
                    prepTime: 15,
                    image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&q=80",
                    variants: [
                        { name: "6 Pieces", price: 120, isDefault: true },
                        { name: "10 Pieces", price: 190 }
                    ],
                    addons: []
                },
                {
                    name: "Veg Steamed Momos",
                    description: "Steamed dumplings filled with finely chopped cabbage, carrot, paneer, and onion.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 10,
                    image: "https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=500&q=80",
                    variants: [
                        { name: "6 Pieces", price: 90, isDefault: true },
                        { name: "10 Pieces", price: 150 }
                    ],
                    addons: []
                }
            ]
        }
    ]
};

// 2. Maggi & Fast Food Point Template
const MaggiTemplate: MenuTemplate = {
    cuisineTypes: ["Fast Food", "Maggi", "Snacks"],
    vegType: VegType.VEG,
    categories: [
        {
            name: "Signature Maggi",
            items: [
                {
                    name: "Double Masala Cheese Maggi",
                    description: "Dehradun tourist favorite: instant noodles with extra spices, melted cheese, and fresh veggies.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 8,
                    image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=500&q=80",
                    variants: [
                        { name: "Single Portion", price: 80, isDefault: true },
                        { name: "Double Portion", price: 130 }
                    ],
                    addons: [
                        {
                            name: "Cheese Upgrade",
                            minSelect: 0,
                            maxSelect: 1,
                            options: [
                                { name: "Amul Cheese Slice", price: 20 }
                            ]
                        }
                    ]
                },
                {
                    name: "Pahadi Butter Veg Maggi",
                    description: "Maggi cooked with mountain spices, carrot, peas, capsicum, and a generous dollop of butter.",
                    type: VegType.VEG,
                    isBestseller: false,
                    prepTime: 8,
                    image: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=500&q=80",
                    variants: [
                        { name: "Standard Bowl", price: 90, isDefault: true }
                    ],
                    addons: []
                }
            ]
        },
        {
            name: "Quick Bites & Tea",
            items: [
                {
                    name: "Bun Butter Samosa",
                    description: "Crispy aloo samosa pressed inside a soft buttered bun with sweet and sour chutneys.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 5,
                    image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500&q=80",
                    variants: [
                        { name: "1 Piece", price: 50, isDefault: true }
                    ],
                    addons: []
                },
                {
                    name: "Adrak Elaichi Cutting Tea",
                    description: "Strong milk tea brewed with hand-crushed fresh ginger and green cardamom.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 7,
                    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&q=80",
                    variants: [
                        { name: "Standard Cup", price: 25, isDefault: true }
                    ],
                    addons: []
                }
            ]
        }
    ]
};

// 3. Pure Veg / Sattvik / Jain Template
const SattvikTemplate: MenuTemplate = {
    cuisineTypes: ["North Indian", "Pure Veg", "Sattvik"],
    vegType: VegType.VEG,
    categories: [
        {
            name: "Sattvik Mains (No Onion No Garlic)",
            items: [
                {
                    name: "Paneer Makhani",
                    description: "Cottage cheese cubes simmered in a creamy tomato sauce sweetened with honey and dry fruits.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 20,
                    image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&q=80",
                    variants: [
                        { name: "Half Handi", price: 190, isDefault: true },
                        { name: "Full Handi", price: 320 }
                    ],
                    addons: []
                },
                {
                    name: "Dal Fry Tadka",
                    description: "Yellow lentils cooked with turmeric and tempered with cumin, hing, and ghee.",
                    type: VegType.VEG,
                    isBestseller: false,
                    prepTime: 15,
                    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80",
                    variants: [
                        { name: "Standard Bowl", price: 150, isDefault: true }
                    ],
                    addons: []
                }
            ]
        },
        {
            name: "Tandoori Breads",
            items: [
                {
                    name: "Aloo Paratha with Curd",
                    description: "Whole wheat paratha stuffed with seasoned potatoes, cooked in tandoor, served with fresh curd.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 12,
                    image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=500&q=80",
                    variants: [
                        { name: "1 Piece", price: 80, isDefault: true }
                    ],
                    addons: []
                },
                {
                    name: "Sattvik Tandoori Roti",
                    description: "Whole wheat flatbread baked in clay oven without butter.",
                    type: VegType.VEG,
                    isBestseller: false,
                    prepTime: 5,
                    image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&q=80",
                    variants: [
                        { name: "Plain", price: 15, isDefault: true },
                        { name: "Butter", price: 20 }
                    ],
                    addons: []
                }
            ]
        }
    ]
};

// 4. Biryani & Mughlai Template
const BiryaniTemplate: MenuTemplate = {
    cuisineTypes: ["Biryani", "North Indian", "Mughlai"],
    vegType: VegType.NON_VEG,
    categories: [
        {
            name: "Dum Biryani",
            items: [
                {
                    name: "Chicken Dum Biryani (Dehradun Style)",
                    description: "Fragrant basmati rice cooked on dum with marinated chicken, saffron, and whole spices.",
                    type: VegType.NON_VEG,
                    isBestseller: true,
                    prepTime: 25,
                    image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=500&q=80",
                    variants: [
                        { name: "Single Pack (1 pc)", price: 230, isDefault: true },
                        { name: "Double Pack (2 pcs)", price: 390 }
                    ],
                    addons: [
                        {
                            name: "Extras",
                            minSelect: 0,
                            maxSelect: 2,
                            options: [
                                { name: "Extra Raita", price: 25 },
                                { name: "Boiled Egg", price: 15 }
                            ]
                        }
                    ]
                },
                {
                    name: "Veg Hyderabadi Dum Biryani",
                    description: "Layered long grain rice with green beans, carrot, potato, paneer, and caramelized onions.",
                    type: VegType.VEG,
                    isBestseller: false,
                    prepTime: 20,
                    image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&q=80",
                    variants: [
                        { name: "Portion (Serves 1-2)", price: 210, isDefault: true }
                    ],
                    addons: []
                }
            ]
        },
        {
            name: "Mughlai Starters",
            items: [
                {
                    name: "Tandoori Paneer Tikka",
                    description: "Cottage cheese cubes marinated in spiced yogurt and grilled in clay oven with onions and capsicum.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 18,
                    image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=500&q=80",
                    variants: [
                        { name: "6 Pieces", price: 240, isDefault: true }
                    ],
                    addons: []
                }
            ]
        }
    ]
};

// 5. Cafe & Italian Template
const CafeTemplate: MenuTemplate = {
    cuisineTypes: ["Cafe", "Italian", "Continental"],
    vegType: VegType.VEG,
    categories: [
        {
            name: "Gourmet Coffees & Shakes",
            items: [
                {
                    name: "Cold Coffee with Vanilla Ice Cream",
                    description: "Creamy blended cold milk, espresso, sugar, topped with chocolate syrup and vanilla ice cream.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 8,
                    image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&q=80",
                    variants: [
                        { name: "300ml Glass", price: 110, isDefault: true }
                    ],
                    addons: []
                }
            ]
        },
        {
            name: "Continental Bites",
            items: [
                {
                    name: "Crispy Double Veg Burger",
                    description: "Crispy double vegetable patty, fresh lettuce, tomato, cheese slice, and secret burger sauce.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 10,
                    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80",
                    variants: [
                        { name: "Single Patty", price: 90 },
                        { name: "Double Patty & Cheese", price: 140, isDefault: true }
                    ],
                    addons: []
                },
                {
                    name: "Alfredo Pasta (White Sauce)",
                    description: "Penne pasta tossed in a creamy parmesan and garlic sauce with mushrooms and olives.",
                    type: VegType.VEG,
                    isBestseller: false,
                    prepTime: 15,
                    image: "https://images.unsplash.com/photo-1645112411341-6c4fd023714a?w=500&q=80",
                    variants: [
                        { name: "Standard Bowl", price: 220, isDefault: true }
                    ],
                    addons: []
                }
            ]
        }
    ]
};

// 6. Multi-Cuisine Hotel & Resort Template
const ResortTemplate: MenuTemplate = {
    cuisineTypes: ["North Indian", "Chinese", "Continental"],
    vegType: VegType.NON_VEG,
    categories: [
        {
            name: "Appetizers",
            items: [
                {
                    name: "Honey Chilli Potato",
                    description: "Crispy french fries tossed in a sweet, spicy, and tangy honey-chilli sauce topped with sesame seeds.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 12,
                    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=500&q=80",
                    variants: [
                        { name: "Full Plate", price: 180, isDefault: true }
                    ],
                    addons: []
                }
            ]
        },
        {
            name: "Indian Main Course",
            items: [
                {
                    name: "Kadhai Paneer",
                    description: "Cottage cheese cooked in a spicy gravy with bell peppers and freshly ground kadhai masala.",
                    type: VegType.VEG,
                    isBestseller: false,
                    prepTime: 20,
                    image: "https://images.unsplash.com/photo-1601050690697-2fc5f24c8153?w=500&q=80",
                    variants: [
                        { name: "Half Portion", price: 220 },
                        { name: "Full Portion", price: 360, isDefault: true }
                    ],
                    addons: []
                },
                {
                    name: "Murg Makhani (Butter Chicken)",
                    description: "Tandoori chicken pieces cooked in a rich, buttery, creamy tomato gravy.",
                    type: VegType.NON_VEG,
                    isBestseller: true,
                    prepTime: 22,
                    image: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&q=80",
                    variants: [
                        { name: "Half Portion", price: 290 },
                        { name: "Full Portion", price: 480, isDefault: true }
                    ],
                    addons: []
                }
            ]
        }
    ]
};

// 7. Sweets, Desserts & Chaat Template
const SweetsTemplate: MenuTemplate = {
    cuisineTypes: ["Sweets", "Street Food", "Chaat"],
    vegType: VegType.VEG,
    categories: [
        {
            name: "Delhi Style Chaat",
            items: [
                {
                    name: "Delhi Special Golgappe",
                    description: "6 pieces of crispy puri served with spicy mint water, sweet tamarind chutney, and a chickpea-potato filling.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 5,
                    image: "https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=500&q=80",
                    variants: [
                        { name: "Atta (Wheat)", price: 50, isDefault: true },
                        { name: "Suji (Semolina)", price: 60 }
                    ],
                    addons: []
                },
                {
                    name: "Aloo Tikki Chaat",
                    description: "Shallow fried potato patties topped with sweet yogurt, mint chutney, tamarind chutney, and sev.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 8,
                    image: "https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500&q=80",
                    variants: [
                        { name: "1 Plate", price: 80, isDefault: true }
                    ],
                    addons: []
                }
            ]
        },
        {
            name: "Traditional Sweets",
            items: [
                {
                    name: "Premium Kaju Katli",
                    description: "Rich, smooth, diamond-shaped cashew fudge made of cashews and sugar syrup.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 5,
                    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&q=80",
                    variants: [
                        { name: "250g Box", price: 250, isDefault: true },
                        { name: "500g Box", price: 480 },
                        { name: "1kg Box", price: 900 }
                    ],
                    addons: []
                }
            ]
        }
    ]
};

// 8. General Dhaba & Comfort Food Template
const DhabaTemplate: MenuTemplate = {
    cuisineTypes: ["Dhaba", "North Indian", "Comfort Food"],
    vegType: VegType.VEG,
    categories: [
        {
            name: "Dhaba Specialties",
            items: [
                {
                    name: "Sev Tamatar Ki Sabji",
                    description: "Spicy tomato-onion curry topped with crispy gram flour sev (North Indian dhaba style).",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 12,
                    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80",
                    variants: [
                        { name: "Full Portion", price: 160, isDefault: true }
                    ],
                    addons: []
                },
                {
                    name: "Yellow Dal Tadka Double Ghee",
                    description: "Boiled yellow pigeon peas tempered twice with garlic, cumin, red chillies, and pure ghee.",
                    type: VegType.VEG,
                    isBestseller: true,
                    prepTime: 12,
                    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80",
                    variants: [
                        { name: "Standard Portion", price: 140, isDefault: true }
                    ],
                    addons: []
                }
            ]
        },
        {
            name: "Indian Breads & Rice",
            items: [
                {
                    name: "Tandoori Butter Roti",
                    description: "Crispy tandoori roti brushed with Amul butter.",
                    type: VegType.VEG,
                    isBestseller: false,
                    prepTime: 5,
                    image: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=500&q=80",
                    variants: [
                        { name: "1 Piece", price: 18, isDefault: true }
                    ],
                    addons: []
                },
                {
                    name: "Basmati Jeera Rice",
                    description: "Long grain basmati rice steamed and tossed with toasted cumin seeds and ghee.",
                    type: VegType.VEG,
                    isBestseller: false,
                    prepTime: 8,
                    image: "https://images.unsplash.com/photo-1603133872878-6966b46880a0?w=500&q=80",
                    variants: [
                        { name: "Half Portion", price: 70 },
                        { name: "Full Portion", price: 120, isDefault: true }
                    ],
                    addons: []
                }
            ]
        }
    ]
};

function getTemplateForRestaurant(name: string, index: number): { template: MenuTemplate; banner: string; logo: string } {
    const nameLower = name.toLowerCase();
    const idx = index;

    // Lhasa / Tibetan Cuisine
    if (nameLower.includes("lhasa")) {
        return {
            template: TibetanTemplate,
            logo: tibetanLogos[idx % tibetanLogos.length],
            banner: tibetanBanners[idx % tibetanBanners.length]
        };
    }

    // Maggi / Tourist spots
    if (nameLower.includes("maggi") || nameLower.includes("maggie") || nameLower.includes("point") || nameLower.includes("spot") || nameLower.includes("tapri") || nameLower.includes("tea")) {
        return {
            template: MaggiTemplate,
            logo: maggiLogos[idx % maggiLogos.length],
            banner: maggiBanners[idx % maggiBanners.length]
        };
    }

    // Pure Veg / Sattvik / Jain
    if (nameLower.includes("saatvik") || nameLower.includes("jain") || nameLower.includes("pure veg") || nameLower.includes("chandan")) {
        return {
            template: SattvikTemplate,
            logo: indianVegLogos[idx % indianVegLogos.length],
            banner: indianVegBanners[idx % indianVegBanners.length]
        };
    }

    // Biryani / Mughlai
    if (nameLower.includes("biryani") || nameLower.includes("kebab") || nameLower.includes("darbar") || nameLower.includes("spice of delhi")) {
        return {
            template: BiryaniTemplate,
            logo: biryaniLogos[idx % biryaniLogos.length],
            banner: biryaniBanners[idx % biryaniBanners.length]
        };
    }

    // Cafe & Italian
    if (nameLower.includes("cafe") || nameLower.includes("coffee") || nameLower.includes("bistro") || nameLower.includes("lounge") || nameLower.includes("burger") || nameLower.includes("pizza")) {
        return {
            template: CafeTemplate,
            logo: cafeLogos[idx % cafeLogos.length],
            banner: cafeBanners[idx % cafeBanners.length]
        };
    }

    // Resort & Hotel Multi-cuisine
    if (nameLower.includes("resort") || nameLower.includes("hotel") || nameLower.includes("heights") || nameLower.includes("inn") || nameLower.includes("guest house") || nameLower.includes("riverbend") || nameLower.includes("crestorio")) {
        return {
            template: ResortTemplate,
            logo: resortLogos[idx % resortLogos.length],
            banner: resortBanners[idx % resortBanners.length]
        };
    }

    // Sweets & Chaat
    if (nameLower.includes("sweet") || nameLower.includes("mithai") || nameLower.includes("chaat") || nameLower.includes("balaji") || nameLower.includes("chatore")) {
        return {
            template: SweetsTemplate,
            logo: sweetsLogos[idx % sweetsLogos.length],
            banner: sweetsBanners[idx % sweetsBanners.length]
        };
    }

    // Default: General Dhaba / Family Restaurant (e.g. Punjabi tadka, Jai Bharat, Sagar, Gupta, Rawat, etc.)
    return {
        template: DhabaTemplate,
        logo: dhabaLogos[idx % dhabaLogos.length],
        banner: dhabaBanners[idx % dhabaBanners.length]
    };
}

async function createMenuItem(categoryId: string, item: MenuItemInput) {
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

// Helper to seed a user with a hashed password in Better Auth Account table
async function seedUserWithPassword(data: {
    id?: string;
    name: string;
    email: string;
    role: Role;
    referralCode: string;
    password: string;
    walletBalance?: number;
    address?: {
        addressLine: string;
        lat: number;
        lng: number;
        receiverName: string;
        receiverPhone: string;
    };
    driverProfile?: {
        status: DriverStatus;
        currentLat: number;
        currentLng: number;
        vehicleType: string;
        vehiclePlate: string;
        licenseNumber: string;
    };
}) {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(data.password);

    const user = await prisma.user.create({
        data: {
            id: data.id,
            name: data.name,
            email: data.email,
            emailVerified: true,
            role: data.role,
            referralCode: data.referralCode,
            wallet: data.walletBalance !== undefined ? {
                create: {
                    balance: data.walletBalance
                }
            } : undefined,
            addresses: data.address ? {
                create: {
                    type: 'HOME',
                    addressLine: data.address.addressLine,
                    lat: data.address.lat,
                    lng: data.address.lng,
                    isDefault: true,
                    receiverName: data.address.receiverName,
                    receiverPhone: data.address.receiverPhone
                }
            } : undefined,
            driverProfile: data.driverProfile ? {
                create: {
                    status: data.driverProfile.status,
                    currentLat: data.driverProfile.currentLat,
                    currentLng: data.driverProfile.currentLng,
                    vehicleType: data.driverProfile.vehicleType,
                    vehiclePlate: data.driverProfile.vehiclePlate,
                    licenseNumber: data.driverProfile.licenseNumber,
                    rating: 4.9,
                    ratingCount: 12
                }
            } : undefined
        }
    });

    await prisma.account.create({
        data: {
            id: `${user.id}_credential`,
            userId: user.id,
            accountId: data.email,
            providerId: 'credential',
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });

    return user;
}

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
    await prisma.restaurantRequest.deleteMany();
    await prisma.restaurant.deleteMany();
    await prisma.driverProfile.deleteMany();
    await prisma.walletTransaction.deleteMany();
    await prisma.walletTopupRequest.deleteMany();
    await prisma.wallet.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await prisma.cuisine.deleteMany();
    await prisma.recentSearch.deleteMany();

    const defaultPassword = 'Password123!';

    console.log('--- Seeding Platform Admin ---');
    await seedUserWithPassword({
        id: 'admin_user',
        name: 'Platform Admin',
        email: 'admin@yofoo.com',
        role: Role.ADMIN,
        referralCode: 'REF_ADMIN',
        password: defaultPassword,
        walletBalance: 10000.0
    });

    console.log('--- Seeding Customers (Pre-funded Wallets + Sahastradhara Addresses) ---');
    const customerData = [
        {
            id: 'cust_1',
            name: 'Priyanshu Sharma',
            email: 'customer1@yofoo.com',
            referralCode: 'REF_CUST1',
            address: 'Pacific Golf Estate, Sahastradhara Rd, Dehradun',
            lat: 30.3781572,
            lng: 78.1090640,
            balance: 2500.0
        },
        {
            id: 'cust_2',
            name: 'Aditya Rawat',
            email: 'customer2@yofoo.com',
            referralCode: 'REF_CUST2',
            address: 'Aman Vihar, Sahastradhara Rd, Dehradun',
            lat: 30.3854460,
            lng: 78.1306932,
            balance: 1500.0
        },
        {
            id: 'cust_3',
            name: 'Neha Nautiyal',
            email: 'customer3@yofoo.com',
            referralCode: 'REF_CUST3',
            address: 'Kulhan Heights, Sahastradhara Rd, Dehradun',
            lat: 30.3768025,
            lng: 78.1084112,
            balance: 3000.0
        }
    ];

    for (const cust of customerData) {
        await seedUserWithPassword({
            id: cust.id,
            name: cust.name,
            email: cust.email,
            role: Role.CUSTOMER,
            referralCode: cust.referralCode,
            password: defaultPassword,
            walletBalance: cust.balance,
            address: {
                addressLine: cust.address,
                lat: cust.lat,
                lng: cust.lng,
                receiverName: cust.name,
                receiverPhone: '9876543210'
            }
        });
    }

    console.log('--- Seeding Delivery Partners (Active, Geo-tagged to Sahastradhara) ---');
    const driverData = [
        {
            id: 'drv_1',
            name: 'Ramesh Singh',
            email: 'driver1@yofoo.com',
            referralCode: 'REF_DRV1',
            vehicle: 'Bike',
            plate: 'UK07AB1234',
            license: 'DL1234567890',
            lat: 30.3850829,
            lng: 78.1283414
        },
        {
            id: 'drv_2',
            name: 'Vikram Negi',
            email: 'driver2@yofoo.com',
            referralCode: 'REF_DRV2',
            vehicle: 'Scooter',
            plate: 'UK07CD5678',
            license: 'DL0987654321',
            lat: 30.3750862,
            lng: 78.1151114
        },
        {
            id: 'drv_3',
            name: 'Suresh Kumar',
            email: 'driver3@yofoo.com',
            referralCode: 'REF_DRV3',
            vehicle: 'Bike',
            plate: 'UK07EF9012',
            license: 'DL5678123490',
            lat: 30.3906298,
            lng: 78.1272833
        }
    ];

    for (const drv of driverData) {
        await seedUserWithPassword({
            id: drv.id,
            name: drv.name,
            email: drv.email,
            role: Role.DELIVERY_PARTNER,
            referralCode: drv.referralCode,
            password: defaultPassword,
            walletBalance: 500.0,
            driverProfile: {
                status: DriverStatus.ONLINE,
                currentLat: drv.lat,
                currentLng: drv.lng,
                vehicleType: drv.vehicle,
                vehiclePlate: drv.plate,
                licenseNumber: drv.license
            }
        });
    }

    console.log('--- Reading CSV File ---');
    const csvPath = path.join(__dirname, '../sahastradhara_restaurants-Restaurants.csv');
    if (!fs.existsSync(csvPath)) {
        throw new Error(`CSV file not found at ${csvPath}`);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    console.log(`Found ${lines.length} lines in CSV.`);

    let restaurantsSeededCount = 0;

    console.log('--- Seeding Restaurants ---');
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields = parseCSVLine(line);
        if (fields.length < 12) {
            console.warn(`Skipping line ${i + 1} due to insufficient columns (${fields.length}):`, line);
            continue;
        }

        const csvId = fields[0];
        const restaurantName = fields[1];
        const rawPhone = fields[2];
        const address = fields[3];
        const rawRating = fields[4];
        const rawReviews = fields[5];
        const priceRange = fields[6];
        const categoryType = fields[7];
        const openHours = fields[8];
        const website = fields[9];
        const rawLat = fields[10];
        const rawLng = fields[11];

        const latVal = parseFloat(rawLat);
        const lngVal = parseFloat(rawLng);

        if (isNaN(latVal) || isNaN(lngVal)) {
            console.warn(`Skipping line ${i + 1} because coordinates are not valid numbers: Lat: ${rawLat}, Lng: ${rawLng}`);
            continue;
        }

        // Parse Rating and RatingCount
        const ratingVal = rawRating === 'N/A' || !rawRating ? parseFloat((3.8 + Math.random() * 1.1).toFixed(1)) : parseFloat(rawRating);
        const reviewsVal = rawReviews === 'N/A' || !rawReviews ? Math.floor(10 + Math.random() * 150) : parseInt(rawReviews.replace(/,/g, ''), 10);

        // Generate unique manager user
        const cleanName = restaurantName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 15);
        const managerEmail = `manager_${cleanName}_${csvId}@yofoo.com`;
        const referralCode = `MGR${csvId}${Math.floor(1000 + Math.random() * 9000)}`;

        const manager = await seedUserWithPassword({
            name: `Manager for ${restaurantName}`,
            email: managerEmail,
            role: Role.RESTAURANT_MANAGER,
            referralCode: referralCode,
            password: defaultPassword
        });

        // Determine menu template and image assets
        const { template, logo, banner } = getTemplateForRestaurant(restaurantName, parseInt(csvId, 10) || i);

        // Randomize Cost For Two (between 150 and 800, stepped by 50)
        const costForTwo = 150 + Math.floor(Math.random() * 14) * 50;

        // Randomize VegType
        let vegType: VegType = VegType.VEG;
        if (template.vegType === VegType.NON_VEG) {
            vegType = Math.random() > 0.4 ? VegType.NON_VEG : VegType.VEG;
        }

        // Create Restaurant Record
        const restaurant = await prisma.restaurant.create({
            data: {
                name: restaurantName,
                description: `Experience the best ${template.cuisineTypes[0]} flavors in Dehradun.`,
                logo: logo,
                banner: banner,
                image: banner,
                costForTwo: costForTwo,
                cuisineTypes: template.cuisineTypes,
                address: address,
                lat: latVal,
                lng: lngVal,
                isActive: true,
                isOpen: true,
                isVerified: true,
                rating: ratingVal,
                ratingCount: reviewsVal,
                fssaiCode: `1002${Math.floor(1000000000 + Math.random() * 9000000000)}`,
                gstNumber: `05AAAAA${Math.floor(1000 + Math.random() * 9000)}A1Z${Math.floor(1 + Math.random() * 9)}`,
                type: vegType,
                managerId: manager.id
            }
        });

        // Seed Categories and Items for this Restaurant
        for (const cat of template.categories) {
            const category = await prisma.menuCategory.create({
                data: {
                    name: cat.name,
                    restaurantId: restaurant.id,
                    type: vegType
                }
            });

            for (const item of cat.items) {
                // Ensure item type aligns with restaurant type
                const itemType = vegType === VegType.VEG ? VegType.VEG : item.type;
                await createMenuItem(category.id, {
                    ...item,
                    type: itemType
                });
            }
        }

        restaurantsSeededCount++;
        if (restaurantsSeededCount % 10 === 0) {
            console.log(`Seeded ${restaurantsSeededCount} restaurants...`);
        }
    }

    console.log('--- Seeding Cuisines ---');
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

    console.log(`--- Seeding Complete! Total Restaurants Seeded: ${restaurantsSeededCount} ---`);
}

main()
    .catch((e) => {
        console.error('Error during seeding:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });