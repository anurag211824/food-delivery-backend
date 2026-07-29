import * as dotenv from 'dotenv';
dotenv.config({ override: true });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com') || process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export interface GlobalProductSeedItem {
  name: string;
  brand: string;
  weight: string;
  unit: string;
  sku: string;
  barcode: string;
  image: string;
  description: string;
  categoryName: string;
  price: number;
  salePrice?: number | null;
  stock: number;
}

export const categoryImages: Record<string, string> = {
  "Dairy, Bread & Eggs": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop",
  "Fruits & Vegetables": "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&auto=format&fit=crop",
  "Snacks, Biscuits & Munchies": "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&auto=format&fit=crop",
  "Beverages & Drinks": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop",
  "Instant Food & Noodles": "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&auto=format&fit=crop",
  "Atta, Rice, Oil & Dals": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&auto=format&fit=crop",
  "Personal Care & Hygiene": "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=600&auto=format&fit=crop",
  "Cleaning & Household Needs": "https://images.unsplash.com/photo-1585842378054-ee2e52f94ba2?w=600&auto=format&fit=crop"
};

export const masterCatalog100: GlobalProductSeedItem[] = [
  // 🥛 1. Dairy, Bread & Eggs
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Amul Taaza Toned Milk",
    brand: "Amul",
    weight: "1",
    unit: "L",
    sku: "AMUL-TAAZA-1L",
    barcode: "8901262000011",
    price: 72,
    salePrice: 70,
    stock: 50,
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop",
    description: "Pasteurised toned milk with 3.0% fat and 8.5% SNF. Fresh and nutritious daily dairy."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Mother Dairy Cow Milk",
    brand: "Mother Dairy",
    weight: "500",
    unit: "ml",
    sku: "MD-COW-500ML",
    barcode: "8901262000012",
    price: 30,
    salePrice: null,
    stock: 45,
    image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&auto=format&fit=crop",
    description: "Pure and fresh cow milk packed with natural calcium, protein and vitamins."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Amul Pasteurised Butter",
    brand: "Amul",
    weight: "500",
    unit: "g",
    sku: "AMUL-BUTTER-500G",
    barcode: "8901262000013",
    price: 275,
    salePrice: 270,
    stock: 30,
    image: "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&auto=format&fit=crop",
    description: "Delicious salted butter churned from fresh cow & buffalo milk cream."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Britannia 100% Whole Wheat Bread",
    brand: "Britannia",
    weight: "400",
    unit: "g",
    sku: "BRIT-BREAD-400G",
    barcode: "8901262000014",
    price: 50,
    salePrice: null,
    stock: 40,
    image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop",
    description: "Healthy 100% whole wheat bread loaf packed with natural dietary fibre."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Fresh Farm Organic Eggs",
    brand: "FarmFresh",
    weight: "10",
    unit: "pcs",
    sku: "EGGS-FARM-10PCS",
    barcode: "8901262000015",
    price: 90,
    salePrice: 85,
    stock: 60,
    image: "https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=600&auto=format&fit=crop",
    description: "Farm-fresh high protein white eggs carefully inspected and packed."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Amul Masti Dahi",
    brand: "Amul",
    weight: "400",
    unit: "g",
    sku: "AMUL-DAHI-400G",
    barcode: "8901262000016",
    price: 35,
    salePrice: null,
    stock: 35,
    image: "https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=600&auto=format&fit=crop",
    description: "Creamy, rich and thick curd made from pasteurised toned milk."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Amul Malai Paneer",
    brand: "Amul",
    weight: "200",
    unit: "g",
    sku: "AMUL-PANEER-200G",
    barcode: "8901262000017",
    price: 95,
    salePrice: null,
    stock: 25,
    image: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop",
    description: "Rich and soft cottage cheese cubes perfect for delicious curries & grills."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Nestle A+ Milkmaid",
    brand: "Nestle",
    weight: "380",
    unit: "g",
    sku: "NESTLE-MILKMAID-380G",
    barcode: "8901262000018",
    price: 145,
    salePrice: 139,
    stock: 20,
    image: "https://images.unsplash.com/photo-1559598467-f8b76c8155d0?w=600&auto=format&fit=crop",
    description: "Sweetened condensed milk ideal for making traditional Indian sweets and desserts."
  },

  // 🥬 2. Fruits & Vegetables
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Hybrid Red Tomatoes",
    brand: "Farm Fresh",
    weight: "1",
    unit: "kg",
    sku: "TOMATO-HYBRID-1KG",
    barcode: "8901262000021",
    price: 40,
    salePrice: 36,
    stock: 80,
    image: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop",
    description: "Firm, bright red juicy tomatoes harvested fresh from local farms daily."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Farm Potatoes",
    brand: "Farm Fresh",
    weight: "1",
    unit: "kg",
    sku: "POTATO-FARM-1KG",
    barcode: "8901262000022",
    price: 30,
    salePrice: null,
    stock: 100,
    image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop",
    description: "Clean, farm-fresh high quality potatoes perfect for curries, frying & baking."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Red Onions",
    brand: "Farm Fresh",
    weight: "1",
    unit: "kg",
    sku: "ONION-RED-1KG",
    barcode: "8901262000023",
    price: 45,
    salePrice: 38,
    stock: 90,
    image: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&auto=format&fit=crop",
    description: "Crispy, pungent red onions essential for daily Indian cooking."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Shimla Red Apples",
    brand: "Organic",
    weight: "500",
    unit: "g",
    sku: "APPLE-SHIMLA-500G",
    barcode: "8901262000024",
    price: 140,
    salePrice: 125,
    stock: 40,
    image: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop",
    description: "Sweet, crunchy and juicy Shimla apples packed with vitamins and antioxidants."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Robusta Bananas",
    brand: "Organic",
    weight: "6",
    unit: "pcs",
    sku: "BANANA-ROBUSTA-6PCS",
    barcode: "8901262000025",
    price: 40,
    salePrice: null,
    stock: 50,
    image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&auto=format&fit=crop",
    description: "Naturally ripened sweet bananas packed with energy and potassium."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Green Capsicum",
    brand: "Farm Fresh",
    weight: "250",
    unit: "g",
    sku: "CAPSICUM-GREEN-250G",
    barcode: "8901262000026",
    price: 25,
    salePrice: null,
    stock: 35,
    image: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&auto=format&fit=crop",
    description: "Crunchy green bell peppers great for salads, noodles, and pizzas."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Coriander Leaves / Dhaniya",
    brand: "Farm Fresh",
    weight: "100",
    unit: "g",
    sku: "CORIANDER-100G",
    barcode: "8901262000027",
    price: 15,
    salePrice: null,
    stock: 60,
    image: "https://images.unsplash.com/photo-1588877681476-36ae596ea659?w=600&auto=format&fit=crop",
    description: "Fresh, fragrant green coriander leaves to garnish your favorite dishes."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Ginger Root",
    brand: "Farm Fresh",
    weight: "200",
    unit: "g",
    sku: "GINGER-200G",
    barcode: "8901262000028",
    price: 35,
    salePrice: 32,
    stock: 45,
    image: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop",
    description: "Pungent and spicy fresh ginger root ideal for tea, curries and immunity drinks."
  },

  // 🍪 3. Snacks, Biscuits & Munchies
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Lays Classic Salted Potato Chips",
    brand: "Lays",
    weight: "50",
    unit: "g",
    sku: "LAYS-SALTED-50G",
    barcode: "8901262000031",
    price: 20,
    salePrice: null,
    stock: 100,
    image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&auto=format&fit=crop",
    description: "Crispy thin potato chips seasoned with fine sea salt."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Lays India's Magic Masala Chips",
    brand: "Lays",
    weight: "50",
    unit: "g",
    sku: "LAYS-MASALA-50G",
    barcode: "8901262000032",
    price: 20,
    salePrice: null,
    stock: 90,
    image: "https://images.unsplash.com/photo-1621447504864-d8686e12698c?w=600&auto=format&fit=crop",
    description: "Spicy Indian masala flavoured crunchy potato chips."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Kurkure Masala Munch",
    brand: "Kurkure",
    weight: "85",
    unit: "g",
    sku: "KURKURE-MASALA-85G",
    barcode: "8901262000033",
    price: 20,
    salePrice: null,
    stock: 80,
    image: "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=600&auto=format&fit=crop",
    description: "Crunchy puffed corn snack infused with chatpata Indian spices."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Parle-G Gold Biscuits",
    brand: "Parle",
    weight: "1",
    unit: "kg",
    sku: "PARLEG-GOLD-1KG",
    barcode: "8901262000034",
    price: 120,
    salePrice: 110,
    stock: 40,
    image: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&auto=format&fit=crop",
    description: "Iconic glucose biscuit packed with wholesome milk & wheat energy."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Britannia Good Day Cashew Cookies",
    brand: "Britannia",
    weight: "200",
    unit: "g",
    sku: "GOODDAY-CASHEW-200G",
    barcode: "8901262000035",
    price: 45,
    salePrice: null,
    stock: 55,
    image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&auto=format&fit=crop",
    description: "Delicious butter cookies loaded with rich crunchy cashew nuts."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Oreo Original Chocolate Cream Biscuits",
    brand: "Cadbury",
    weight: "120",
    unit: "g",
    sku: "OREO-ORIGINAL-120G",
    barcode: "8901262000036",
    price: 35,
    salePrice: null,
    stock: 60,
    image: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&auto=format&fit=crop",
    description: "Rich dark chocolate cookie sandwich with smooth vanilla cream inside."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Doritos Nacho Cheese Tortilla Chips",
    brand: "Doritos",
    weight: "82.5",
    unit: "g",
    sku: "DORITOS-NACHO-82G",
    barcode: "8901262000037",
    price: 50,
    salePrice: 45,
    stock: 45,
    image: "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=600&auto=format&fit=crop",
    description: "Bold and cheesy triangular corn tortilla chips."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Haldiram's Nagpur Bhujia Sev",
    brand: "Haldiram",
    weight: "400",
    unit: "g",
    sku: "HALDIRAM-BHUJIA-400G",
    barcode: "8901262000038",
    price: 110,
    salePrice: 105,
    stock: 35,
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop",
    description: "Authentic crispy fried gram flour noodles spiced with traditional seasonings."
  },

  // 🥤 4. Beverages & Drinks
  {
    categoryName: "Beverages & Drinks",
    name: "Coca-Cola Original Taste Soft Drink",
    brand: "Coca-Cola",
    weight: "750",
    unit: "ml",
    sku: "COCACOLA-750ML",
    barcode: "8901262000041",
    price: 45,
    salePrice: null,
    stock: 70,
    image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop",
    description: "Chilled sparkling fizzy cola beverage with crisp original taste."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Thums Up Charged Soft Drink",
    brand: "Thums Up",
    weight: "750",
    unit: "ml",
    sku: "THUMSUP-750ML",
    barcode: "8901262000042",
    price: 45,
    salePrice: null,
    stock: 75,
    image: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600&auto=format&fit=crop",
    description: "Strong, spicy fizzy cola soft drink with intense taste."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Sprite Lime Flavored Soft Drink",
    brand: "Sprite",
    weight: "750",
    unit: "ml",
    sku: "SPRITE-750ML",
    barcode: "8901262000043",
    price: 45,
    salePrice: null,
    stock: 65,
    image: "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=600&auto=format&fit=crop",
    description: "Refreshing lemon-lime carbonated drink to quench your thirst."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Real Fruit Power Mixed Fruit Juice",
    brand: "Real",
    weight: "1",
    unit: "L",
    sku: "REAL-MIXEDJUICE-1L",
    barcode: "8901262000044",
    price: 130,
    salePrice: 115,
    stock: 40,
    image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop",
    description: "Rich blend of 9 delicious real fruits with no added preservatives."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Red Bull Energy Drink",
    brand: "Red Bull",
    weight: "250",
    unit: "ml",
    sku: "REDBULL-CAN-250ML",
    barcode: "8901262000045",
    price: 125,
    salePrice: null,
    stock: 50,
    image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=600&auto=format&fit=crop",
    description: "Vitalizes body and mind with taurine, caffeine and essential B-vitamins."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Bisleri Mineral Water",
    brand: "Bisleri",
    weight: "1",
    unit: "L",
    sku: "BISLERI-WATER-1L",
    barcode: "8901262000046",
    price: 20,
    salePrice: null,
    stock: 120,
    image: "https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=600&auto=format&fit=crop",
    description: "Purified, ozonated drinking water enriched with minerals."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Nescafe Classic Instant Coffee",
    brand: "Nescafe",
    weight: "50",
    unit: "g",
    sku: "NESCAFE-CLASSIC-50G",
    barcode: "8901262000047",
    price: 190,
    salePrice: 175,
    stock: 30,
    image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop",
    description: "100% pure instant coffee powder crafted from dark roasted beans."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Red Label Natural Care Tea",
    brand: "Brooke Bond",
    weight: "500",
    unit: "g",
    sku: "REDLABEL-TEA-500G",
    barcode: "8901262000048",
    price: 310,
    salePrice: 295,
    stock: 25,
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop",
    description: "Black tea infused with 5 natural Ayurvedic herbs: Tulsi, Ginger, Mulethi, Cardamom & Ashwagandha."
  },

  // 🍜 5. Instant Food & Noodles
  {
    categoryName: "Instant Food & Noodles",
    name: "Maggi 2-Minute Masala Noodles",
    brand: "Maggi",
    weight: "280",
    unit: "g",
    sku: "MAGGI-MASALA-4PACK",
    barcode: "8901262000051",
    price: 58,
    salePrice: null,
    stock: 90,
    image: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&auto=format&fit=crop",
    description: "Classic favorite instant noodles with signature roasted spice mix."
  },
  {
    categoryName: "Instant Food & Noodles",
    name: "Knorr Classic Tomato Soup",
    brand: "Knorr",
    weight: "53",
    unit: "g",
    sku: "KNORR-TOMATO-53G",
    barcode: "8901262000052",
    price: 55,
    salePrice: null,
    stock: 40,
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&auto=format&fit=crop",
    description: "Creamy, hot tomato instant soup made with real vegetable bits."
  },
  {
    categoryName: "Instant Food & Noodles",
    name: "Sunfeast Yippee Magic Masala Noodles",
    brand: "Sunfeast",
    weight: "240",
    unit: "g",
    sku: "YIPPEE-MASALA-240G",
    barcode: "8901262000053",
    price: 48,
    salePrice: null,
    stock: 50,
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop",
    description: "Long non-sticky instant noodles packed with real dehydrated vegetables."
  },
  {
    categoryName: "Instant Food & Noodles",
    name: "Chings Secret Schezwan Noodles",
    brand: "Chings",
    weight: "240",
    unit: "g",
    sku: "CHINGS-SCHEZWAN-240G",
    barcode: "8901262000054",
    price: 50,
    salePrice: null,
    stock: 35,
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop",
    description: "Fiery Desi Chinese Schezwan flavored instant noodles."
  },
  {
    categoryName: "Instant Food & Noodles",
    name: "Nissin Cup Noodles Masala",
    brand: "Nissin",
    weight: "70",
    unit: "g",
    sku: "NISSIN-CUP-MASALA-70G",
    barcode: "8901262000055",
    price: 50,
    salePrice: null,
    stock: 45,
    image: "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=600&auto=format&fit=crop",
    description: "On-the-go instant cup noodles with authentic Indian masala seasoning."
  },
  {
    categoryName: "Instant Food & Noodles",
    name: "Kissan Fresh Tomato Ketchup",
    brand: "Kissan",
    weight: "950",
    unit: "g",
    sku: "KISSAN-KETCHUP-950G",
    barcode: "8901262000056",
    price: 140,
    salePrice: 128,
    stock: 30,
    image: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&auto=format&fit=crop",
    description: "Made from 100% real sun-ripened tomatoes for rich tangy taste."
  },

  // 🌾 6. Atta, Rice, Oil & Dals
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Aashirvaad Shuddh Chakki Atta",
    brand: "Aashirvaad",
    weight: "5",
    unit: "kg",
    sku: "AASHIRVAAD-ATTA-5KG",
    barcode: "8901262000061",
    price: 260,
    salePrice: 245,
    stock: 40,
    image: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&auto=format&fit=crop",
    description: "100% pure whole wheat flour ground in traditional stone chakkis for soft rotis."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Fortune Sunlite Refined Sunflower Oil",
    brand: "Fortune",
    weight: "1",
    unit: "L",
    sku: "FORTUNE-SUNFLOWER-1L",
    barcode: "8901262000062",
    price: 145,
    salePrice: 138,
    stock: 50,
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop",
    description: "Light, healthy refined sunflower cooking oil rich in natural Vitamin E."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "India Gate Basmati Rice Rozzana",
    brand: "India Gate",
    weight: "5",
    unit: "kg",
    sku: "INDIAGATE-RICE-5KG",
    barcode: "8901262000063",
    price: 450,
    salePrice: 420,
    stock: 25,
    image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop",
    description: "Aged long-grain basmati rice perfect for everyday meals and pulao."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Tata Salt Vacuum Evaporated Salt",
    brand: "Tata",
    weight: "1",
    unit: "kg",
    sku: "TATA-SALT-1KG",
    barcode: "8901262000064",
    price: 28,
    salePrice: null,
    stock: 100,
    image: "https://images.unsplash.com/photo-1518110168401-f2877ee2c88c?w=600&auto=format&fit=crop",
    description: "Pure vacuum evaporated iodised salt for optimal health and taste."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Tata Sampann Unpolished Toor Dal",
    brand: "Tata Sampann",
    weight: "1",
    unit: "kg",
    sku: "TATA-TOORDAL-1KG",
    barcode: "8901262000065",
    price: 175,
    salePrice: 165,
    stock: 35,
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop",
    description: "Unpolished Arhar/Toor dal rich in natural protein without artificial polishing."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Fortune Kachi Ghani Mustard Oil",
    brand: "Fortune",
    weight: "1",
    unit: "L",
    sku: "FORTUNE-MUSTARD-1L",
    barcode: "8901262000066",
    price: 155,
    salePrice: 145,
    stock: 40,
    image: "https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?w=600&auto=format&fit=crop",
    description: "Pungent cold-pressed raw mustard oil for authentic flavor."
  },

  // 🧼 7. Personal Care & Hygiene
  {
    categoryName: "Personal Care & Hygiene",
    name: "Dettol Original Germ Soap (Pack of 3)",
    brand: "Dettol",
    weight: "375",
    unit: "g",
    sku: "DETTOL-SOAP-3PACK",
    barcode: "8901262000071",
    price: 160,
    salePrice: 145,
    stock: 45,
    image: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=600&auto=format&fit=crop",
    description: "Trusted antibacterial germ protection bathing soap bar."
  },
  {
    categoryName: "Personal Care & Hygiene",
    name: "Colgate Strong Teeth Toothpaste",
    brand: "Colgate",
    weight: "500",
    unit: "g",
    sku: "COLGATE-STRONG-500G",
    barcode: "8901262000072",
    price: 240,
    salePrice: 220,
    stock: 35,
    image: "https://images.unsplash.com/photo-1559598467-f8b76c8155d0?w=600&auto=format&fit=crop",
    description: "Calcium-boosted toothpaste for 2x stronger teeth and fresh breath."
  },
  {
    categoryName: "Personal Care & Hygiene",
    name: "Dove Cream Beauty Bathing Bar (Pack of 3)",
    brand: "Dove",
    weight: "225",
    unit: "g",
    sku: "DOVE-SOAP-3PACK",
    barcode: "8901262000073",
    price: 195,
    salePrice: 180,
    stock: 30,
    image: "https://images.unsplash.com/photo-1607006482140-410d7a0494cf?w=600&auto=format&fit=crop",
    description: "Formulated with 1/4 moisturising cream for soft, smooth & glowing skin."
  },
  {
    categoryName: "Personal Care & Hygiene",
    name: "Head & Shoulders Smooth & Silky Shampoo",
    brand: "Head & Shoulders",
    weight: "180",
    unit: "ml",
    sku: "HEADSHOULDERS-180ML",
    barcode: "8901262000074",
    price: 185,
    salePrice: null,
    stock: 40,
    image: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=600&auto=format&fit=crop",
    description: "Anti-dandruff shampoo that restores dry, frizzy hair to 100% flake-free smoothness."
  },

  // 🧴 8. Cleaning & Household Needs
  {
    categoryName: "Cleaning & Household Needs",
    name: "Surf Excel Easy Wash Detergent Powder",
    brand: "Surf Excel",
    weight: "1",
    unit: "kg",
    sku: "SURFEXCEL-1KG",
    barcode: "8901262000081",
    price: 150,
    salePrice: 140,
    stock: 50,
    image: "https://images.unsplash.com/photo-1585842378054-ee2e52f94ba2?w=600&auto=format&fit=crop",
    description: "Tough stain-removing laundry detergent powder for hand & machine wash."
  },
  {
    categoryName: "Cleaning & Household Needs",
    name: "Vim Dishwash Gel Lemon",
    brand: "Vim",
    weight: "500",
    unit: "ml",
    sku: "VIM-GEL-500ML",
    barcode: "8901262000082",
    price: 125,
    salePrice: 115,
    stock: 60,
    image: "https://images.unsplash.com/photo-1585842378084-5f56e0708573?w=600&auto=format&fit=crop",
    description: "Concentrated lemon dishwashing liquid gel for grease-free clean utensils."
  },

  // 🥛 9. NEW ITEMS (51 - 100)
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Epigamia Greek Yogurt Strawberry",
    brand: "Epigamia",
    weight: "85",
    unit: "g",
    sku: "EPIGAMIA-YOGURT-85G",
    barcode: "8901262000083",
    price: 60,
    salePrice: 55,
    stock: 40,
    image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop",
    description: "High protein Greek yogurt with real strawberry fruit bits."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Amul Processed Cheese Slices (10 Slices)",
    brand: "Amul",
    weight: "200",
    unit: "g",
    sku: "AMUL-CHEESE-SLICES",
    barcode: "8901262000084",
    price: 145,
    salePrice: null,
    stock: 50,
    image: "https://images.unsplash.com/photo-1625085456168-f6c42518f2ed?w=600&auto=format&fit=crop",
    description: "Wholesome processed cheese slices perfect for burgers & sandwiches."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Amul Fresh Cream",
    brand: "Amul",
    weight: "250",
    unit: "ml",
    sku: "AMUL-CREAM-250ML",
    barcode: "8901262000085",
    price: 68,
    salePrice: null,
    stock: 35,
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop",
    description: "Sterilised low fat cream for rich gravy dishes and desserts."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Britannia Fruit Cake",
    brand: "Britannia",
    weight: "150",
    unit: "g",
    sku: "BRIT-FRUITCAKE-150G",
    barcode: "8901262000086",
    price: 40,
    salePrice: null,
    stock: 45,
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop",
    description: "Soft sponge cake packed with delicious candied fruit bits."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Amul Pure Cow Ghee",
    brand: "Amul",
    weight: "1",
    unit: "L",
    sku: "AMUL-GHEE-1L",
    barcode: "8901262000087",
    price: 650,
    salePrice: 615,
    stock: 30,
    image: "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop",
    description: "Aromatic pure cow ghee with rich granular texture."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Yakult Probiotic Health Drink (5 Pack)",
    brand: "Yakult",
    weight: "325",
    unit: "ml",
    sku: "YAKULT-PROBIOTIC-5P",
    barcode: "8901262000088",
    price: 80,
    salePrice: null,
    stock: 60,
    image: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop",
    description: "Fermented milk drink containing billions of beneficial Shirota bacteria for gut health."
  },

  // 🥬 10. Fresh Produce (Fruits & Veggies)
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Hass Avocados",
    brand: "Organic",
    weight: "2",
    unit: "pcs",
    sku: "AVOCADO-HASS-2PCS",
    barcode: "8901262000089",
    price: 180,
    salePrice: 160,
    stock: 25,
    image: "https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&auto=format&fit=crop",
    description: "Rich and creamy Hass avocados packed with healthy omega fatty acids."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Green Broccoli",
    brand: "Farm Fresh",
    weight: "250",
    unit: "g",
    sku: "BROCCOLI-GREEN-250G",
    barcode: "8901262000090",
    price: 50,
    salePrice: 42,
    stock: 30,
    image: "https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600&auto=format&fit=crop",
    description: "Crisp green broccoli florets high in fibre and antioxidants."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Button Mushrooms",
    brand: "Farm Fresh",
    weight: "200",
    unit: "g",
    sku: "MUSHROOM-BUTTON-200G",
    barcode: "8901262000091",
    price: 60,
    salePrice: 52,
    stock: 35,
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop",
    description: "Plump and tender white button mushrooms harvested daily."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Alphonso Mangoes",
    brand: "Organic",
    weight: "1",
    unit: "kg",
    sku: "MANGO-ALPHONSO-1KG",
    barcode: "8901262000092",
    price: 350,
    salePrice: 310,
    stock: 40,
    image: "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600&auto=format&fit=crop",
    description: "Sweet, aromatic Ratnagiri Alphonso mangoes with rich golden pulp."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Yellow Lemons",
    brand: "Farm Fresh",
    weight: "250",
    unit: "g",
    sku: "LEMON-YELLOW-250G",
    barcode: "8901262000093",
    price: 25,
    salePrice: null,
    stock: 70,
    image: "https://images.unsplash.com/photo-1534531141161-e41604741593?w=600&auto=format&fit=crop",
    description: "Juicy citrus yellow lemons high in Vitamin C."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Cucumbers / Kheera",
    brand: "Farm Fresh",
    weight: "500",
    unit: "g",
    sku: "CUCUMBER-GREEN-500G",
    barcode: "8901262000094",
    price: 30,
    salePrice: null,
    stock: 55,
    image: "https://images.unsplash.com/photo-1447175008436-0841709069d0?w=600&auto=format&fit=crop",
    description: "Crisp and hydrating green cucumbers perfect for summer salads."
  },
  {
    categoryName: "Fruits & Vegetables",
    name: "Fresh Sweet Green Peas",
    brand: "Farm Fresh",
    weight: "500",
    unit: "g",
    sku: "GREENPEAS-FRESH-500G",
    barcode: "8901262000095",
    price: 45,
    salePrice: null,
    stock: 40,
    image: "https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=600&auto=format&fit=crop",
    description: "Tender sweet green peas pods filled with natural goodness."
  },

  // 🍪 11. Chocolates & Confectionery
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Cadbury Dairy Milk Silk Chocolate",
    brand: "Cadbury",
    weight: "150",
    unit: "g",
    sku: "CADBURY-SILK-150G",
    barcode: "8901262000096",
    price: 175,
    salePrice: 165,
    stock: 60,
    image: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=600&auto=format&fit=crop",
    description: "Ultra smooth and creamy milk chocolate bar that melts in your mouth."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Nestle KitKat 4-Finger Chocolate Bar",
    brand: "Nestle",
    weight: "38",
    unit: "g",
    sku: "KITKAT-4FINGER-38G",
    barcode: "8901262000097",
    price: 30,
    salePrice: null,
    stock: 85,
    image: "https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=600&auto=format&fit=crop",
    description: "Crispy wafer fingers covered in smooth milk chocolate."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Ferrero Rocher Hazelnut Chocolates (16 pcs)",
    brand: "Ferrero Rocher",
    weight: "200",
    unit: "g",
    sku: "FERRERO-ROCHER-16P",
    barcode: "8901262000098",
    price: 550,
    salePrice: 499,
    stock: 25,
    image: "https://images.unsplash.com/photo-1548907040-4baa42d10919?w=600&auto=format&fit=crop",
    description: "Whole roasted hazelnut wrapped in a delicate crispy wafer shell filled with hazelnut cream."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Pringles Original Potato Crisps",
    brand: "Pringles",
    weight: "107",
    unit: "g",
    sku: "PRINGLES-ORIGINAL-107G",
    barcode: "8901262000099",
    price: 115,
    salePrice: 105,
    stock: 45,
    image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&auto=format&fit=crop",
    description: "Iconic stackable potato crisps packed in a protective resealable can."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Parle Hide & Seek Chocolate Chip Cookies",
    brand: "Parle",
    weight: "120",
    unit: "g",
    sku: "HIDESEEK-COOKIE-120G",
    barcode: "8901262000100",
    price: 35,
    salePrice: null,
    stock: 75,
    image: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&auto=format&fit=crop",
    description: "Crispy chocolate cookies studded with real dark chocolate chips."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Haldiram's Aloo Bhujia Namkeen",
    brand: "Haldiram",
    weight: "200",
    unit: "g",
    sku: "HALDIRAM-ALOOBHUJIA-200G",
    barcode: "8901262000101",
    price: 55,
    salePrice: null,
    stock: 65,
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop",
    description: "Spicy and crunchy potato-flour noodles seasoned with traditional Indian spices."
  },
  {
    categoryName: "Snacks, Biscuits & Munchies",
    name: "Act II Instant Butter Popcorn",
    brand: "Act II",
    weight: "90",
    unit: "g",
    sku: "ACT2-BUTTERPOPCORN-90G",
    barcode: "8901262000102",
    price: 40,
    salePrice: null,
    stock: 50,
    image: "https://images.unsplash.com/photo-1578849278619-e73505e9610f?w=600&auto=format&fit=crop",
    description: "Hot, delicious butter-flavored microwave instant popcorn."
  },

  // 🥤 12. Beverages & Juices
  {
    categoryName: "Beverages & Drinks",
    name: "Tropicana 100% Orange Juice",
    brand: "Tropicana",
    weight: "1",
    unit: "L",
    sku: "TROPICANA-ORANGE-1L",
    barcode: "8901262000103",
    price: 140,
    salePrice: 125,
    stock: 35,
    image: "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop",
    description: "100% pure squeezed orange juice with no added sugar or water."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Frooti Real Mango Drink",
    brand: "Parle Agro",
    weight: "1.2",
    unit: "L",
    sku: "FROOTI-MANGO-1.2L",
    barcode: "8901262000104",
    price: 75,
    salePrice: 68,
    stock: 45,
    image: "https://images.unsplash.com/photo-1546171753-97d7676e4602?w=600&auto=format&fit=crop",
    description: "Refreshing mango drink made from real Alphonso mango pulp."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Paper Boat Aamras Mango Drink",
    brand: "Paper Boat",
    weight: "200",
    unit: "ml",
    sku: "PAPERBOAT-AAMRAS-200ML",
    barcode: "8901262000105",
    price: 35,
    salePrice: null,
    stock: 60,
    image: "https://images.unsplash.com/photo-1546171753-97d7676e4602?w=600&auto=format&fit=crop",
    description: "Authentic Indian Aamras drink with 45% real mango pulp."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Monster Energy Ultra Drink",
    brand: "Monster",
    weight: "350",
    unit: "ml",
    sku: "MONSTER-ULTRA-350ML",
    barcode: "8901262000106",
    price: 125,
    salePrice: null,
    stock: 40,
    image: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=600&auto=format&fit=crop",
    description: "Zero sugar citrus energy drink infused with B-vitamins & L-Carnitine."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Tetley Green Tea Lemon & Honey (25 Bags)",
    brand: "Tetley",
    weight: "50",
    unit: "g",
    sku: "TETLEY-GREENTEA-25TB",
    barcode: "8901262000107",
    price: 180,
    salePrice: 165,
    stock: 30,
    image: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop",
    description: "Refreshing green tea bags infused with natural lemon flavor & honey."
  },
  {
    categoryName: "Beverages & Drinks",
    name: "Bournvita Chocolate Health Drink",
    brand: "Cadbury",
    weight: "500",
    unit: "g",
    sku: "BOURNVITA-CHOC-500G",
    barcode: "8901262000108",
    price: 260,
    salePrice: 240,
    stock: 35,
    image: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop",
    description: "Malt-based health drink powder with essential minerals, Vitamin D and Calcium."
  },

  // 🥣 13. Breakfast & Pantry Staples
  {
    categoryName: "Instant Food & Noodles",
    name: "Kellogg's Corn Flakes Original",
    brand: "Kellogg's",
    weight: "475",
    unit: "g",
    sku: "KELLOGGS-CORNFLAKES-475G",
    barcode: "8901262000109",
    price: 195,
    salePrice: 175,
    stock: 40,
    image: "https://images.unsplash.com/photo-1521483451569-e33803c0330c?w=600&auto=format&fit=crop",
    description: "Crispy golden corn flakes enriched with 8 essential vitamins."
  },
  {
    categoryName: "Instant Food & Noodles",
    name: "Quaker Rolled Oats",
    brand: "Quaker",
    weight: "1",
    unit: "kg",
    sku: "QUAKER-OATS-1KG",
    barcode: "8901262000110",
    price: 199,
    salePrice: 179,
    stock: 45,
    image: "https://images.unsplash.com/photo-1517093157656-b9ecdf173b31?w=600&auto=format&fit=crop",
    description: "100% natural wholegrain oats high in soluble fibre & beta-glucan."
  },
  {
    categoryName: "Instant Food & Noodles",
    name: "Nutella Hazelnut Cocoa Spread",
    brand: "Ferrero",
    weight: "350",
    unit: "g",
    sku: "NUTELLA-SPREAD-350G",
    barcode: "8901262000111",
    price: 385,
    salePrice: 360,
    stock: 30,
    image: "https://images.unsplash.com/photo-1528751014936-863e6e7a319c?w=600&auto=format&fit=crop",
    description: "Delicious hazelnut cocoa spread made with premium ingredients."
  },
  {
    categoryName: "Instant Food & Noodles",
    name: "FunFoods Peanut Butter Crunchy",
    brand: "Dr. Oetker",
    weight: "400",
    unit: "g",
    sku: "FUNFOODS-PEANUTBUTTER-400G",
    barcode: "8901262000112",
    price: 170,
    salePrice: 155,
    stock: 50,
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop",
    description: "High protein crunchy peanut butter made from roasted peanuts."
  },
  {
    categoryName: "Instant Food & Noodles",
    name: "MTR Instant Rava Idli Mix",
    brand: "MTR",
    weight: "500",
    unit: "g",
    sku: "MTR-RAVAIDLI-500G",
    barcode: "8901262000113",
    price: 110,
    salePrice: null,
    stock: 35,
    image: "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop",
    description: "Traditional South Indian semolina idli ready-to-cook breakfast mix."
  },
  {
    categoryName: "Dairy, Bread & Eggs",
    name: "Del Monte Shredded Mozzarella Cheese",
    brand: "Del Monte",
    weight: "200",
    unit: "g",
    sku: "DELMONTE-MOZZARELLA-200G",
    barcode: "8901262000114",
    price: 165,
    salePrice: null,
    stock: 25,
    image: "https://images.unsplash.com/photo-1625085456168-f6c42518f2ed?w=600&auto=format&fit=crop",
    description: "Shredded pizza mozzarella cheese with high stretchability."
  },

  // 🌾 14. Spices, Oils & Pulses
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Catch Red Chilli Powder (Lal Mirch)",
    brand: "Catch",
    weight: "200",
    unit: "g",
    sku: "CATCH-REDCHILLI-200G",
    barcode: "8901262000115",
    price: 85,
    salePrice: null,
    stock: 60,
    image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop",
    description: "Rich red fiery chilli powder ground from handpicked stemless red chillies."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Everest Turmeric Powder (Haldi)",
    brand: "Everest",
    weight: "200",
    unit: "g",
    sku: "EVEREST-HALDI-200G",
    barcode: "8901262000116",
    price: 65,
    salePrice: null,
    stock: 70,
    image: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600&auto=format&fit=crop",
    description: "High curcumin aromatic turmeric powder for natural color and health."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "MDH Super Garam Masala",
    brand: "MDH",
    weight: "100",
    unit: "g",
    sku: "MDH-GARAMMASALA-100G",
    barcode: "8901262000117",
    price: 95,
    salePrice: 88,
    stock: 55,
    image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop",
    description: "Aromatic blend of whole roasted Indian spices for rich curry flavors."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Tata Sampann Unpolished Moong Dal Chilka",
    brand: "Tata Sampann",
    weight: "1",
    unit: "kg",
    sku: "TATA-MOONGDAL-1KG",
    barcode: "8901262000118",
    price: 165,
    salePrice: 152,
    stock: 40,
    image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop",
    description: "High protein unpolished split green gram lentils."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Saffola Gold Pro Healthy Refined Cooking Oil",
    brand: "Saffola",
    weight: "1",
    unit: "L",
    sku: "SAFFOLA-GOLD-1L",
    barcode: "8901262000119",
    price: 175,
    salePrice: 162,
    stock: 45,
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop",
    description: "Dual-seed oil blend of rice bran & sunflower oil for heart health."
  },
  {
    categoryName: "Atta, Rice, Oil & Dals",
    name: "Catch Cumin Seeds (Jeera)",
    brand: "Catch",
    weight: "100",
    unit: "g",
    sku: "CATCH-JEERA-100G",
    barcode: "8901262000120",
    price: 75,
    salePrice: null,
    stock: 50,
    image: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop",
    description: "Clean, aromatic whole cumin seeds for tadka and seasoning."
  },

  // 🧼 15. Skincare & Hygiene
  {
    categoryName: "Personal Care & Hygiene",
    name: "Nivea Soft Light Moisturiser Cream",
    brand: "Nivea",
    weight: "100",
    unit: "ml",
    sku: "NIVEA-SOFT-100ML",
    barcode: "8901262000121",
    price: 199,
    salePrice: 179,
    stock: 35,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop",
    description: "Non-greasy light moisturising cream enriched with Vitamin E & Jojoba Oil."
  },
  {
    categoryName: "Personal Care & Hygiene",
    name: "Gillette Mach3 Turbo Men's Razor",
    brand: "Gillette",
    weight: "1",
    unit: "pc",
    sku: "GILLETTE-MACH3-1PC",
    barcode: "8901262000122",
    price: 325,
    salePrice: 295,
    stock: 25,
    image: "https://images.unsplash.com/photo-1621607512214-68297480165e?w=600&auto=format&fit=crop",
    description: "3-blade men's razor with lubrication strip for a smooth close shave."
  },
  {
    categoryName: "Personal Care & Hygiene",
    name: "Pears Pure & Gentle Glycerin Soap (3 Pack)",
    brand: "Pears",
    weight: "375",
    unit: "g",
    sku: "PEARS-SOAP-3PACK",
    barcode: "8901262000123",
    price: 210,
    salePrice: 190,
    stock: 40,
    image: "https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=600&auto=format&fit=crop",
    description: "Transparent glycerin bathing bar with 98% pure glycerin."
  },
  {
    categoryName: "Personal Care & Hygiene",
    name: "Dettol Instant Hand Sanitizer Gel",
    brand: "Dettol",
    weight: "200",
    unit: "ml",
    sku: "DETTOL-SANITIZER-200ML",
    barcode: "8901262000124",
    price: 100,
    salePrice: null,
    stock: 60,
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop",
    description: "Rinse-free alcohol hand sanitizer gel killing 99.9% germs instantly."
  },
  {
    categoryName: "Personal Care & Hygiene",
    name: "Whisper Choice Ultra Wings Sanitary Pads (20 Pads)",
    brand: "Whisper",
    weight: "20",
    unit: "pcs",
    sku: "WHISPER-PADS-20PCS",
    barcode: "8901262000125",
    price: 195,
    salePrice: 175,
    stock: 45,
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop",
    description: "Extra long wings sanitary napkins with stain-lock magic gel technology."
  },
  {
    categoryName: "Personal Care & Hygiene",
    name: "Vaseline Intensive Care Deep Restore Lotion",
    brand: "Vaseline",
    weight: "400",
    unit: "ml",
    sku: "VASELINE-LOTION-400ML",
    barcode: "8901262000126",
    price: 325,
    salePrice: 285,
    stock: 30,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop",
    description: "Deep absorbing body lotion infused with micro-droplets of Vaseline jelly."
  },

  // 🧴 16. Household & Pet Care
  {
    categoryName: "Cleaning & Household Needs",
    name: "Harpic Disinfectant Toilet Cleaner Liquid",
    brand: "Harpic",
    weight: "1",
    unit: "L",
    sku: "HARPIC-TOILETCLEANER-1L",
    barcode: "8901262000127",
    price: 215,
    salePrice: 195,
    stock: 50,
    image: "https://images.unsplash.com/photo-1585842378054-ee2e52f94ba2?w=600&auto=format&fit=crop",
    description: "Thick disinfectant liquid cleaner removing 99.9% germs & tough limescale stains."
  },
  {
    categoryName: "Cleaning & Household Needs",
    name: "Colin Glass & Surface Cleaner Spray",
    brand: "Colin",
    weight: "500",
    unit: "ml",
    sku: "COLIN-GLASS-500ML",
    barcode: "8901262000128",
    price: 110,
    salePrice: null,
    stock: 45,
    image: "https://images.unsplash.com/photo-1585842378084-5f56e0708573?w=600&auto=format&fit=crop",
    description: "Shine booster spray cleaner for streak-free glass, mirrors & appliances."
  },
  {
    categoryName: "Cleaning & Household Needs",
    name: "Lizol Disinfectant Surface Floor Cleaner Citrus",
    brand: "Lizol",
    weight: "1",
    unit: "L",
    sku: "LIZOL-FLOORCLEANER-1L",
    barcode: "8901262000129",
    price: 225,
    salePrice: 205,
    stock: 55,
    image: "https://images.unsplash.com/photo-1585842378054-ee2e52f94ba2?w=600&auto=format&fit=crop",
    description: "Citrus fragrance floor cleaner leaving surfaces sparkling clean."
  },
  {
    categoryName: "Cleaning & Household Needs",
    name: "Pedigree Adult Dry Dog Food Chicken & Veg",
    brand: "Pedigree",
    weight: "1.2",
    unit: "kg",
    sku: "PEDIGREE-DOGFOOD-1.2KG",
    barcode: "8901262000130",
    price: 380,
    salePrice: 350,
    stock: 20,
    image: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop",
    description: "Complete nutritious dry dog food with high protein for adult dogs."
  },
  {
    categoryName: "Cleaning & Household Needs",
    name: "Whiskas Wet Cat Food Gravy Salmon",
    brand: "Whiskas",
    weight: "340",
    unit: "g",
    sku: "WHISKAS-CATFOOD-4P",
    barcode: "8901262000131",
    price: 220,
    salePrice: 200,
    stock: 25,
    image: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop",
    description: "Delicious wet cat food pouch in salmon gravy for adult cats."
  },
  {
    categoryName: "Cleaning & Household Needs",
    name: "Goodknight Gold Flash Mosquito Repellent Refill",
    brand: "Goodknight",
    weight: "45",
    unit: "ml",
    sku: "GOODKNIGHT-REFILL-45ML",
    barcode: "8901262000132",
    price: 85,
    salePrice: null,
    stock: 60,
    image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop",
    description: "Liquid vapourizer refill for 60 nights mosquito protection."
  }
];

async function seedGlobalMasterCatalog() {
  console.log("=========================================================");
  console.log("📦 SEEDING 100 GLOBAL MASTER CATALOG & CATEGORY IMAGES");
  console.log("=========================================================");

  const stores = await prisma.store.findMany();

  // 1. Update/Synchronize StoreCategory images explicitly for ALL stores
  for (const store of stores) {
    for (const [catName, catImg] of Object.entries(categoryImages)) {
      const existingCat = await prisma.storeCategory.findFirst({
        where: { storeId: store.id, name: catName }
      });

      if (existingCat) {
        await prisma.storeCategory.update({
          where: { id: existingCat.id },
          data: { image: catImg }
        });
      } else {
        await prisma.storeCategory.create({
          data: {
            storeId: store.id,
            name: catName,
            image: catImg,
          }
        });
      }
      console.log(`🖼️  Updated Category Image: "${catName}" -> ${catImg.substring(0, 45)}...`);
    }
  }

  // 2. Seed Master Catalog & Store Inventory
  const store = stores[0];
  let seededGlobalProducts = 0;
  let seededInventoryItems = 0;

  for (const item of masterCatalog100) {
    const product = await prisma.product.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        brand: item.brand,
        weight: item.weight,
        unit: item.unit,
        image: item.image,
        description: item.description,
        barcode: item.barcode,
      },
      create: {
        name: item.name,
        brand: item.brand,
        weight: item.weight,
        unit: item.unit,
        image: item.image,
        description: item.description,
        sku: item.sku,
        barcode: item.barcode,
      },
    });
    seededGlobalProducts++;

    if (store) {
      const storeCat = await prisma.storeCategory.findFirst({
        where: { storeId: store.id, name: item.categoryName },
      });

      if (storeCat) {
        await prisma.storeInventory.upsert({
          where: {
            storeId_productId: {
              storeId: store.id,
              productId: product.id,
            },
          },
          update: {
            categoryId: storeCat.id,
            price: item.price,
            salePrice: item.salePrice,
            stock: item.stock,
            isAvailable: true,
          },
          create: {
            storeId: store.id,
            productId: product.id,
            categoryId: storeCat.id,
            price: item.price,
            salePrice: item.salePrice,
            stock: item.stock,
            isAvailable: true,
          },
        });
        seededInventoryItems++;
      }
    }
  }

  console.log("=========================================================");
  console.log(`✨ SUCCESS: Category Images & Master Catalog Updated!`);
  console.log("=========================================================");
}

seedGlobalMasterCatalog()
  .catch((err) => {
    console.error("❌ Seed Script Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
