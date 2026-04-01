import React, { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import '../styles/Offers.css';
import Footer from '../components/Footer';

interface Product {
    id: string;
    brand: string;
    name: string;
    price: number;
    originalPrice: number;
    discount: number;
    image: string;
    category: string;
    gender: string;
    color: string;
    rating: number;
    reviews: number;
    shortDescription: string;
    relatedImages: string[];
    isFewLeft?: boolean;
}

const offerProducts: Product[] = [
    {
        id: 'o1',
        brand: 'V-Mart',
        name: 'Girls Printed Top with Shorts',
        price: 413,
        originalPrice: 449,
        discount: 8,
        image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing Set',
        gender: 'Girls',
        color: 'Pink',
        rating: 4.4,
        reviews: 147,
        shortDescription: 'Comfortable and stylish cotton printed top paired with matching shorts. Perfect for casual summer outings.',
        relatedImages: [
            'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1621452973707-63965674763b?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&q=80&w=600'
        ],
        isFewLeft: true
    },
    {
        id: 'o2',
        brand: 'NOBERO',
        name: 'Oversized Cotton Co-Ords',
        price: 1699,
        originalPrice: 3999,
        discount: 58,
        image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=600',
        category: 'Co-Ords',
        gender: 'Men',
        color: 'Beige',
        rating: 4.2,
        reviews: 441,
        shortDescription: 'Modern oversized fit co-ord set crafted from premium breathable cotton. Ideal for street style and lounge sessions.',
        relatedImages: [
            'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1594932293297-dc55f3299763?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o3',
        brand: 'bebe',
        name: 'Sheath Midi Dress',
        price: 593,
        originalPrice: 3299,
        discount: 82,
        image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=600',
        category: 'Dresses',
        gender: 'Women',
        color: 'Maroon',
        rating: 3.9,
        reviews: 26,
        shortDescription: 'Elegant sheath midi dress with a flattering silhouette. Perfect for evening parties or formal dinners.',
        relatedImages: [
            'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o4',
        brand: 'bebe',
        name: 'Season Staples Knitted Dress',
        price: 1439,
        originalPrice: 7999,
        discount: 82,
        image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&q=80&w=600',
        category: 'Dresses',
        gender: 'Women',
        color: 'White',
        rating: 4.1,
        reviews: 45,
        shortDescription: 'Cozy knitted dress for the modern woman. A versatile piece that blends comfort with high-end fashion.',
        relatedImages: [
            'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o5',
        brand: 'LITTLE GINNIE',
        name: 'Boys Ethnic Wear Set',
        price: 899,
        originalPrice: 1999,
        discount: 55,
        image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing Set',
        gender: 'Boys',
        color: 'Blue',
        rating: 4.5,
        reviews: 632,
        shortDescription: 'Traditional ethnic wear set for boys. Features intricate embroidery and premium fabric for special occasions.',
        relatedImages: [
            'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1565463674817-4c07dcafd17d?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o6',
        brand: 'NOBERO',
        name: 'Casual Lounge Wear',
        price: 1299,
        originalPrice: 2499,
        discount: 48,
        image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&q=80&w=600',
        category: 'Co-Ords',
        gender: 'Men',
        color: 'Grey',
        rating: 3.9,
        reviews: 1200,
        shortDescription: 'Ultimate comfort lounge wear. Designed for relaxing at home while maintaining a polished look.',
        relatedImages: [
            'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o7',
        brand: 'V-Mart',
        name: 'Pure Cotton Graphic T-Shirt',
        price: 299,
        originalPrice: 599,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=600',
        category: 'T-Shirts',
        gender: 'Men',
        color: 'White',
        rating: 4.3,
        reviews: 856,
        shortDescription: 'Breathable pure cotton t-shirt with trendy graphic prints. A staple for every wardrobe.',
        relatedImages: [
            'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o8',
        brand: 'bebe',
        name: 'Floral Print A-Line Dress',
        price: 1250,
        originalPrice: 4999,
        discount: 75,
        image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=600',
        category: 'Dresses',
        gender: 'Women',
        color: 'Blue',
        rating: 4.6,
        reviews: 120,
        shortDescription: 'Vibrant floral print on a classic A-line silhouette. Perfect for summer brunches and outdoor events.',
        relatedImages: [
            'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o9',
        brand: 'NOBERO',
        name: 'Lightweight Training Set',
        price: 1899,
        originalPrice: 3499,
        discount: 45,
        image: 'https://images.unsplash.com/photo-1554568218-0f1715e72254?auto=format&fit=crop&q=80&w=600',
        category: 'Co-Ords',
        gender: 'Women',
        color: 'Yellow',
        rating: 4.0,
        reviews: 230,
        shortDescription: 'High-performance lightweight training set. Moisture-wicking fabric for intense gym sessions.',
        relatedImages: [
            'https://images.unsplash.com/photo-1554568218-0f1715e72254?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o10',
        brand: 'LITTLE GINNIE',
        name: 'Infant Cotton Romper',
        price: 499,
        originalPrice: 999,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing Set',
        gender: 'Boys',
        color: 'Green',
        rating: 4.7,
        reviews: 45,
        shortDescription: 'Soft and breathable cotton romper for infants. Snap buttons for easy dressing.',
        relatedImages: [
            'https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o11',
        brand: 'V-Mart',
        name: 'Slim Fit Denim Jeans',
        price: 899,
        originalPrice: 1799,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing Set',
        gender: 'Men',
        color: 'Blue',
        rating: 4.1,
        reviews: 2100,
        shortDescription: 'Classic slim fit denim jeans with a modern wash. Durable and stylish for everyday wear.',
        relatedImages: [
            'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o12',
        brand: 'bebe',
        name: 'Evening Sequin Gown',
        price: 4500,
        originalPrice: 15000,
        discount: 70,
        image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=600',
        category: 'Dresses',
        gender: 'Women',
        color: 'Black',
        rating: 4.8,
        reviews: 89,
        shortDescription: 'Stunning sequin gown for unforgettable evenings. Timeless elegance and glamour.',
        relatedImages: [
            'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o13',
        brand: 'NOBERO',
        name: 'Tech-Dry Polo Shirt',
        price: 699,
        originalPrice: 1299,
        discount: 46,
        image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&q=80&w=600',
        category: 'T-Shirts',
        gender: 'Men',
        color: 'Red',
        rating: 4.2,
        reviews: 560,
        shortDescription: 'Tech-Dry polo shirt designed for active lifestyles. Quick-dry technology for ultimate performance.',
        relatedImages: [
            'https://images.unsplash.com/photo-1581655353564-df123a1eb820?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o14',
        brand: 'LITTLE GINNIE',
        name: 'Girls party Wear Frock',
        price: 1599,
        originalPrice: 3200,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&q=80&w=600',
        category: 'Dresses',
        gender: 'Girls',
        color: 'Pink',
        rating: 4.5,
        reviews: 112,
        shortDescription: 'Elegant party wear frock for girls. Beautiful craftsmanship and premium fabrics.',
        relatedImages: [
            'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o15',
        brand: 'V-Mart',
        name: 'Checked Casual Shirt',
        price: 549,
        originalPrice: 1099,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600',
        category: 'T-Shirts',
        gender: 'Men',
        color: 'Red',
        rating: 4.2,
        reviews: 320,
        shortDescription: 'Classic checked pattern casual shirt. Versatile enough for office and casual outings.',
        relatedImages: [
            'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o16',
        brand: 'bebe',
        name: 'High-Low Hem Dress',
        price: 1750,
        originalPrice: 6999,
        discount: 75,
        image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&q=80&w=600',
        category: 'Dresses',
        gender: 'Women',
        color: 'Blue',
        rating: 4.4,
        reviews: 156,
        shortDescription: 'Modern high-low hem dress for a contemporary look. A unique design that stands out.',
        relatedImages: [
            'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o17',
        brand: 'NOBERO',
        name: 'Urban Streetwear Hooded Set',
        price: 2499,
        originalPrice: 4999,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&q=80&w=600',
        category: 'Co-Ords',
        gender: 'Men',
        color: 'Black',
        rating: 4.6,
        reviews: 890,
        shortDescription: 'Edgy urban streetwear hooded set. Bold design and superior comfort for the urban explorer.',
        relatedImages: [
            'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o18',
        brand: 'LITTLE GINNIE',
        name: 'Boys Cotton Shorts Pack',
        price: 599,
        originalPrice: 1199,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing Set',
        gender: 'Boys',
        color: 'Blue',
        rating: 4.3,
        reviews: 450,
        shortDescription: 'Pack of essential cotton shorts for boys. Durable, breathable, and perfect for play.',
        relatedImages: [
            'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o19',
        brand: 'V-Mart',
        name: 'Women Striped Kurti',
        price: 399,
        originalPrice: 999,
        discount: 60,
        image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing Set',
        gender: 'Women',
        color: 'Green',
        rating: 4.1,
        reviews: 1200,
        shortDescription: 'Elegant striped kurti for women. A perfect blend of traditional and contemporary styles.',
        relatedImages: [
            'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1620619767323-b95a89183081?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o20',
        brand: 'bebe',
        name: 'Lace Overlay Cocktail Dress',
        price: 2999,
        originalPrice: 9999,
        discount: 70,
        image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600',
        category: 'Dresses',
        gender: 'Women',
        color: 'Pink',
        rating: 4.7,
        reviews: 67,
        shortDescription: 'Sophisticated cocktail dress with delicate lace overlay. Perfect for weddings and formal parties.',
        relatedImages: [
            'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o21',
        brand: 'NOBERO',
        name: 'Comfy Jogger Set',
        price: 1599,
        originalPrice: 3199,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600',
        category: 'Co-Ords',
        gender: 'Women',
        color: 'Grey',
        rating: 4.5,
        reviews: 540,
        shortDescription: 'Relaxed jogger set for women. Designed for both style and comfort during your off-duty days.',
        relatedImages: [
            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1554568218-0f1715e72254?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o22',
        brand: 'LITTLE GINNIE',
        name: 'Baby Girls Flower Dress',
        price: 799,
        originalPrice: 1599,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1555009393-f20bdb245c4d?auto=format&fit=crop&q=80&w=600',
        category: 'Dresses',
        gender: 'Girls',
        color: 'White',
        rating: 4.8,
        reviews: 32,
        shortDescription: 'Charming flower dress for baby girls. Soft linings ensures comfort for your little one.',
        relatedImages: [
            'https://images.unsplash.com/photo-1555009393-f20bdb245c4d?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o23',
        brand: 'V-Mart',
        name: 'Men Regular Fit Chinos',
        price: 799,
        originalPrice: 1599,
        discount: 50,
        image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing Set',
        gender: 'Men',
        color: 'Beige',
        rating: 4.3,
        reviews: 670,
        shortDescription: 'Versatile regular fit chinos for men. Perfect for both casual and semi-formal occasions.',
        relatedImages: [
            'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=600'
        ]
    },
    {
        id: 'o24',
        brand: 'bebe',
        name: 'Pleated Velvet Skirt',
        price: 899,
        originalPrice: 3599,
        discount: 75,
        image: 'https://images.unsplash.com/photo-1620619767323-b95a89183081?auto=format&fit=crop&q=80&w=600',
        category: 'Clothing Set',
        gender: 'Women',
        color: 'Maroon',
        rating: 4.4,
        reviews: 88,
        shortDescription: 'Luxurious pleated velvet skirt. A statement piece that adds texture and elegance to any outfit.',
        relatedImages: [
            'https://images.unsplash.com/photo-1620619767323-b95a89183081?auto=format&fit=crop&q=80&w=600',
            'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=600'
        ]
    }
];

const Offers: React.FC = () => {
    const { addToCart } = useCart();
    const { toggleWishlist, isWishlisted } = useWishlist();
    const initialFilters = {
        genders: [] as string[],
        categories: [] as string[],
        brands: [] as string[],
        colors: [] as string[],
        discountRange: null as number | null
    };

    const [filters, setFilters] = useState(initialFilters);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [activeImage, setActiveImage] = useState<string>('');

    const openModal = (product: Product) => {
        setSelectedProduct(product);
        setActiveImage(product.image);
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        setSelectedProduct(null);
        document.body.style.overflow = 'unset';
    };

    const hasFilters = filters.genders.length > 0 ||
        filters.categories.length > 0 ||
        filters.brands.length > 0 ||
        filters.colors.length > 0 ||
        filters.discountRange !== null;

    const clearFilters = () => setFilters(initialFilters);

    const categories = ['Clothing Set', 'Co-Ords', 'Dresses', 'T-Shirts'];
    const genders = ['Men', 'Women', 'Kids'];
    const brands = ['V-Mart', 'NOBERO', 'bebe', 'LITTLE GINNIE'];
    const colors = [
        { name: 'Blue', code: '#0000ff', count: 18138 },
        { name: 'Black', code: '#000000', count: 16214 },
        { name: 'White', code: '#ffffff', border: true, count: 16173 },
        { name: 'Pink', code: '#ffc0cb', count: 14857 },
        { name: 'Green', code: '#008000', count: 12232 },
        { name: 'Yellow', code: '#ffff00', count: 7384 },
        { name: 'Red', code: '#ff0000', count: 6859 }
    ];

    const toggleFilter = (type: keyof typeof filters, value: any) => {
        setFilters(prev => {
            const current = (prev[type] as any[]);
            if (current.includes(value)) {
                return { ...prev, [type]: current.filter(v => v !== value) };
            }
            return { ...prev, [type]: [...current, value] };
        });
    };

    const filteredProducts = offerProducts.filter(p => {
        const genderMatch = filters.genders.length === 0 || filters.genders.some(g => {
            if (g === 'Kids') return p.gender === 'Boys' || p.gender === 'Girls' || p.gender === 'Kids';
            return p.gender === g;
        });
        const categoryMatch = filters.categories.length === 0 || filters.categories.includes(p.category);
        const brandMatch = filters.brands.length === 0 || filters.brands.includes(p.brand);
        const colorMatch = filters.colors.length === 0 || filters.colors.includes(p.color);
        const discountMatch = filters.discountRange === null || p.discount >= filters.discountRange;

        return genderMatch && categoryMatch && brandMatch && colorMatch && discountMatch;
    });

    return (
        <div className="offers-page">
            <div className="offers-container container">
                <aside className="filters-sidebar">
                    <div className="sidebar-header">
                        <h3>FILTERS</h3>
                        {hasFilters && (
                            <button className="clear-all-btn" onClick={clearFilters}>
                                CLEAR ALL
                            </button>
                        )}
                    </div>
                    <div className="filter-section">
                        <div className="filter-group">
                            {genders.map(g => (
                                <label key={g} className="filter-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={filters.genders.includes(g)}
                                        onChange={() => toggleFilter('genders', g)}
                                    />
                                    <span>{g}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3>CATEGORIES</h3>
                        <div className="filter-group">
                            {categories.map(c => (
                                <label key={c} className="filter-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={filters.categories.includes(c)}
                                        onChange={() => toggleFilter('categories', c)}
                                    />
                                    <span>{c}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3>BRAND</h3>
                        <div className="filter-group">
                            {brands.map(b => (
                                <label key={b} className="filter-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={filters.brands.includes(b)}
                                        onChange={() => toggleFilter('brands', b)}
                                    />
                                    <span>{b}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3>COLOR</h3>
                        <div className="color-grid">
                            {colors.map(c => (
                                <div
                                    key={c.name}
                                    className={`color-item ${filters.colors.includes(c.name) ? 'active' : ''}`}
                                    onClick={() => toggleFilter('colors', c.name)}
                                >
                                    <span
                                        className="color-swatch"
                                        style={{ backgroundColor: c.code, border: c.border ? '1px solid #ddd' : 'none' }}
                                    ></span>
                                    <span className="color-name">{c.name}</span>
                                    <span className="color-count">({c.count})</span>
                                </div>
                            ))}
                            <button className="more-btn">+ 43 more</button>
                        </div>
                    </div>

                    <div className="filter-section">
                        <h3>DISCOUNT RANGE</h3>
                        <div className="filter-group">
                            {[10, 20, 30, 40, 50, 60, 70, 80].map(d => (
                                <label key={d} className="filter-radio">
                                    <input
                                        type="radio"
                                        name="discount"
                                        checked={filters.discountRange === d}
                                        onChange={() => setFilters(prev => ({ ...prev, discountRange: d }))}
                                    />
                                    <span>{d}% and above</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </aside>

                <main className="offers-content">
                    <div className="content-header">
                        <div className="breadcrumbs">Home / Clothing / <span>Offer</span></div>
                        <div className="results-info">
                            <h2>Offer <span>- {filteredProducts.length} items</span></h2>
                        </div>
                        <div className="sort-bar">
                            <span>Sort by : <b>Recommended</b></span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                        </div>
                    </div>

                    <div className="offer-products-grid">
                        {filteredProducts.map(product => (
                            <div key={product.id} className="offer-product-card">
                                <div className="card-image" onClick={() => openModal(product)} style={{ cursor: 'pointer' }}>
                                    <img src={product.image} alt={product.name} />
                                    <div className="rating-badge">
                                        <span>{product.rating} ★ | {product.reviews >= 1000 ? (product.reviews / 1000).toFixed(1) + 'k' : product.reviews}</span>
                                    </div>
                                    <button
                                        className={`wishlist-btn ${isWishlisted(product.id) ? 'wishlisted' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); toggleWishlist({ id: product.id, name: product.name, price: product.price, image: product.image }); }}
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted(product.id) ? '#ff4747' : 'none'} stroke={isWishlisted(product.id) ? '#ff4747' : '#282C3F'} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                        <span>{isWishlisted(product.id) ? 'WISHLISTED' : 'WISHLIST'}</span>
                                    </button>
                                </div>
                                <div className="card-info">
                                    <h3 className="brand-name">{product.brand}</h3>
                                    <p className="product-desc">{product.name}</p>
                                    <div className="price-row">
                                        <span className="current-price">Rs. {product.price}</span>
                                        <span className="original-price">Rs. {product.originalPrice}</span>
                                        <span className="discount-tag">({product.discount}% OFF)</span>
                                    </div>
                                    {product.isFewLeft && <p className="few-left">Only Few Left!</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedProduct && (
                        <div className="product-modal-overlay" onClick={closeModal}>
                            <div className="product-modal-content" onClick={(e) => e.stopPropagation()}>
                                <button className="modal-close-btn" onClick={closeModal}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                                </button>

                                <div className="modal-body">
                                    <div className="modal-gallery">
                                        <div className="main-image-container">
                                            <img src={activeImage} alt={selectedProduct.name} />
                                        </div>
                                        <div className="thumbnail-strip">
                                            {selectedProduct.relatedImages.map((img, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`thumbnail-item ${activeImage === img ? 'active' : ''}`}
                                                    onClick={() => setActiveImage(img)}
                                                >
                                                    <img src={img} alt={`${selectedProduct.name} ${idx + 1}`} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="modal-details">
                                        <h2 className="modal-brand">{selectedProduct.brand}</h2>
                                        <p className="modal-name">{selectedProduct.name}</p>

                                        <div className="modal-rating">
                                            <span>{selectedProduct.rating} ★ | {selectedProduct.reviews} Ratings</span>
                                        </div>

                                        <div className="modal-price-row">
                                            <span className="modal-current-price">Rs. {selectedProduct.price}</span>
                                            <span className="modal-original-price">Rs. {selectedProduct.originalPrice}</span>
                                            <span className="modal-discount">({selectedProduct.discount}% OFF)</span>
                                        </div>

                                        <div className="modal-description">
                                            <h4>Product Details</h4>
                                            <p>{selectedProduct.shortDescription}</p>
                                        </div>

                                        <div className="modal-actions">
                                            <button className="add-to-bag-btn" onClick={() => addToCart({ id: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price, image: selectedProduct.image, size: 'Default', quantity: 1 })}>ADD TO BAG</button>
                                            <button
                                                className={`modal-wishlist-btn ${isWishlisted(selectedProduct.id) ? 'wishlisted' : ''}`}
                                                onClick={() => toggleWishlist({ id: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price, image: selectedProduct.image })}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted(selectedProduct.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                                {isWishlisted(selectedProduct.id) ? 'WISHLISTED' : 'WISHLIST'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
            <Footer />
        </div>
    );
};

export default Offers;
