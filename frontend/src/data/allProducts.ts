export interface Product {
    id: string;
    name: string;
    price: string;
    image: string;
    images?: string[];
    category: string;
    rating: number;
    gender?: string;
    tags?: string[];
    has_variants?: boolean;
    price_range?: string;
    variant_count?: number;
}

export const allProducts: Product[] = [
    // Electronics from Electronics.tsx
    { id: 'e1', name: 'iPhone 15 Pro Max', price: '₹1,34,900', image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=600', category: 'Electronics', rating: 4.8, tags: ['mobile', 'phone', 'iphone', 'apple'] },
    { id: 'e2', name: 'MacBook Pro 16"', price: '₹2,49,900', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=600', category: 'Electronics', rating: 4.9, tags: ['laptop', 'macbook', 'computer', 'apple', 'pc'] },
    { id: 'e3', name: 'Sony WH-1000XM5', price: '₹29,990', image: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=600', category: 'Electronics', rating: 4.7, tags: ['headphones', 'audio', 'sony'] },
    { id: 'e4', name: 'Apple Watch Ultra', price: '₹82,900', image: 'https://images.unsplash.com/photo-1610461888750-10bfc601b874?auto=format&fit=crop&q=80&w=600', category: 'Electronics', rating: 4.9, tags: ['watch', 'smartwatch', 'apple'] },
    { id: 'e5', name: 'Canon Mirrorless Digital Cam', price: '₹2,15,995', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=600', category: 'Electronics', rating: 4.8, tags: ['camera', 'canon', 'photography'] },
    { id: 'e6', name: 'Neo QLED 8K Smart TV', price: '₹1,89,990', image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&q=80&w=600', category: 'Electronics', rating: 4.8, tags: ['tv', 'television', 'led', 'smart tv'] },
    { id: 'e7', name: 'Premium Front-Load Washer', price: '₹42,990', image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&q=80&w=600', category: 'Electronics', rating: 4.4, tags: ['washing machine', 'washer', 'home appliance'] },
    { id: 'e8', name: 'Bespoke Smart Refrigerator', price: '₹1,64,990', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=600', category: 'Electronics', rating: 4.6, tags: ['fridge', 'refrigerator', 'home appliance'] },

    // Fashion from Fashion.tsx
    { id: 'f1', name: 'Premium Italian Denim', price: '₹5,499', image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.5, gender: 'Men', tags: ['jeans', 'mens', 'denim'] },
    { id: 'f2', name: 'Pure Silk Oversized Shirt', price: '₹4,499', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.7, gender: 'Men', tags: ['shirt', 'mens', 'silk'] },
    { id: 'f3', name: 'Bespoke Tailored Blazer', price: '₹18,499', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.8, gender: 'Men', tags: ['blazer', 'formal', 'mens'] },
    { id: 'f4', name: 'Vintage Leather Biker Jacket', price: '₹22,999', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.9, gender: 'Men', tags: ['jacket', 'mens', 'leather'] },
    { id: 'f5', name: 'Midnight Silk Evening Gown', price: '₹34,999', image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.9, gender: 'Women', tags: ['dress', 'womens', 'gown'] },
    { id: 'f6', name: 'Designer Stiletto Heels', price: '₹28,999', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.8, gender: 'Women', tags: ['shoes', 'heels', 'womens'] },
    { id: 'f7', name: 'Luxury Cotton Party Romper', price: '₹4,599', image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.6, gender: 'Kids', tags: ['kids', 'clothing', 'romper'] },
    { id: 'f8', name: 'Designer Kids Celebration Wear', price: '₹7,299', image: 'https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.7, gender: 'Kids', tags: ['kids', 'clothing', 'traditional'] },

    // Sarees
    { id: 's1', name: 'Royal Kanjeevaram Silk Saree', price: '₹12,999', image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.8, gender: 'Women', tags: ['saree', 'traditional', 'womens', 'sari'] },
    { id: 's2', name: 'Banarasi Brocade Saree', price: '₹15,499', image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.9, gender: 'Women', tags: ['saree', 'traditional', 'womens', 'sari'] },
    { id: 's3', name: 'Chiffon Party Wear Saree', price: '₹4,299', image: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQ7Mf_AEgDtZJtyDed_zKmbqR0KlzHOz-LsMNm5tKT66_Y8qnPgaKAnxDsDYwFlxDYw7dEslfBEdkdzHsnfYvRdVEfJFPwuPS1Ah4Wkwu5ySOc4udgPVT_7OqE', category: 'Fashion', rating: 4.6, gender: 'Women', tags: ['saree', 'party', 'womens', 'sari'] },

    // Women's Bags
    { id: 'wb1', name: 'Designer Leather Handbag', price: '₹8,999', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.7, gender: 'Women', tags: ['bag', 'womens', 'handbag', 'leather'] },
    { id: 'wb2', name: 'Luxury Tote Bag', price: '₹12,499', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.8, gender: 'Women', tags: ['bag', 'womens', 'tote'] },
    { id: 'wb3', name: 'Crossbody Sling Bag', price: '₹3,499', image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.5, gender: 'Women', tags: ['bag', 'womens', 'sling', 'crossbody'] },
    { id: 'wb4', name: 'Evening Clutch Purse', price: '₹5,999', image: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.6, gender: 'Women', tags: ['bag', 'womens', 'clutch', 'purse'] },

    // Women's Cosmetics
    { id: 'wc1', name: 'Premium Makeup Kit', price: '₹4,999', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.8, gender: 'Women', tags: ['cosmetics', 'womens', 'makeup'] },
    { id: 'wc2', name: 'Luxury Lipstick Collection', price: '₹2,499', image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.7, gender: 'Women', tags: ['cosmetics', 'womens', 'lipstick', 'makeup'] },
    { id: 'wc3', name: 'Skincare Essentials Set', price: '₹6,999', image: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.9, gender: 'Women', tags: ['cosmetics', 'womens', 'skincare'] },
    { id: 'wc4', name: 'Professional Makeup Brushes', price: '₹1,999', image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.6, gender: 'Women', tags: ['cosmetics', 'womens', 'makeup', 'brushes'] },

    // Women's Shoes
    { id: 'ws1', name: 'Classic Pumps Heels', price: '₹4,999', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.7, gender: 'Women', tags: ['shoes', 'womens', 'heels', 'pumps'] },
    { id: 'ws2', name: 'Casual Sneakers', price: '₹3,499', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.5, gender: 'Women', tags: ['shoes', 'womens', 'sneakers'] },
    { id: 'ws3', name: 'Ankle Boots', price: '₹7,999', image: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.8, gender: 'Women', tags: ['shoes', 'womens', 'boots'] },

    // Furniture
    { id: 'fn1', name: 'Velvet Royal Sofa', price: '₹85,900', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=600', category: 'Furniture', rating: 4.8, tags: ['sofa', 'living room', 'couch'] },
    { id: 'fn2', name: 'King Size Hand-Carved Bed', price: '₹1,44,900', image: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&q=80&w=600', category: 'Furniture', rating: 4.9, tags: ['bed', 'bedroom', 'king size'] },
    { id: 'fn3', name: 'Modern Scandi Dining Set', price: '₹84,500', image: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&q=80&w=600', category: 'Furniture', rating: 4.7, tags: ['dining', 'table', 'chairs'] },
    { id: 'fn4', name: 'Executive Ergonomic Chair', price: '₹28,900', image: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&q=80&w=600', category: 'Furniture', rating: 4.6, tags: ['chair', 'office', 'ergonomic'] },
    { id: 'fn5', name: 'Solid Walnut Wardrobe', price: '₹65,000', image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&q=80&w=600', category: 'Furniture', rating: 4.5, tags: ['wardrobe', 'bedroom', 'closet'] },

    // Books
    { id: 'b1', name: 'Limited Edition Fiction Novel', price: '₹1,499', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800', category: 'Books', rating: 4.9, tags: ['fiction', 'novel', 'book'] },
    { id: 'b2', name: 'Science & The Cosmos Elite', price: '₹2,899', image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800', category: 'Books', rating: 4.8, tags: ['science', 'academic', 'book'] },
    { id: 'b3', name: 'The Art of Master Cooking', price: '₹3,200', image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=800', category: 'Books', rating: 4.7, tags: ['cooking', 'non-fiction', 'cookbook'] },
    { id: 'b4', name: 'Hand-Drawn Vintage Map Collection', price: '₹5,650', image: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&q=80&w=800', category: 'Books', rating: 4.9, tags: ['map', 'history', 'non-fiction'] },
    { id: 'b5', name: 'Modern Global Architecture', price: '₹4,500', image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800', category: 'Books', rating: 4.9, tags: ['architecture', 'academic'] },

    // Sports
    { id: 'sp1', name: 'Professional English Willow', price: '₹65,900', image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=600', category: 'Sports', rating: 4.9, tags: ['cricket', 'bat'] },
    { id: 'sp2', name: 'Elite Carbon-Fibre Boots', price: '₹18,500', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600', category: 'Sports', rating: 4.7, tags: ['football', 'boots', 'shoes'] },
    { id: 'sp3', name: 'Ultimate Gym Essentials Kit', price: '₹12,999', image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=600', category: 'Sports', rating: 4.8, tags: ['gym', 'fitness', 'workout'] },
    { id: 'sp4', name: 'Graphite Tennis Racket', price: '₹32,000', image: 'https://images.unsplash.com/photo-1622279457486-62dcc4a4bd13?auto=format&fit=crop&q=80&w=600', category: 'Sports', rating: 4.6, tags: ['tennis', 'racket'] },
    { id: 'sp5', name: 'Professional Grade Treadmill', price: '₹2,55,000', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=600', category: 'Sports', rating: 4.9, tags: ['gym', 'fitness', 'treadmill'] },

    // Accessories
    { id: 'a1', name: 'Swiss Chronograph Series X', price: '₹1,45,000', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800', category: 'Accessories', rating: 4.9, tags: ['watch', 'luxury', 'chronograph'] },
    { id: 'a2', name: 'Polarized Aviator Elite', price: '₹15,900', image: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=800', category: 'Accessories', rating: 4.7, tags: ['sunglasses', 'aviator', 'shades'] },
    { id: 'a3', name: 'Handcrafted Luxury Leather Bag', price: '₹22,500', image: 'https://images.unsplash.com/photo-1547949003-9792a18a2601?auto=format&fit=crop&q=80&w=800', category: 'Accessories', rating: 4.8, tags: ['bag', 'leather', 'handbag'] },
    { id: 'a4', name: 'Premium Hand-Stitched Belt', price: '₹8,500', image: 'https://images.unsplash.com/photo-1624222247344-550fbadcd973?auto=format&fit=crop&q=80&w=800', category: 'Accessories', rating: 4.5, tags: ['belt', 'leather'] },
    { id: 'a5', name: 'Signature Jewellery Collection', price: '₹3,45,000', image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=800', category: 'Accessories', rating: 5.0, tags: ['jewellery', 'gold', 'diamond', 'necklace'] },

    // New Arrivals
    { id: 'n1', name: 'Oversized Graffiti Hoodie', price: '₹2,499', image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.8, gender: 'Men', tags: ['hoodie', 'mens', 'sneakerhead'] },
    { id: 'n2', name: 'Linen Blend Blazer', price: '₹5,999', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.6, gender: 'Women', tags: ['blazer', 'womens', 'linen'] },
    { id: 'n3', name: 'High-Top Suede Sneakers', price: '₹3,299', image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.4, gender: 'Men', tags: ['shoes', 'sneakers', 'mens'] },
    { id: 'n4', name: 'Relaxed Fit Cargo Pants', price: '₹2,299', image: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.5, gender: 'Men', tags: ['pants', 'cargo', 'mens'] },
    { id: 'n5', name: 'Watch Ultra 2', price: '₹89,900', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600', category: 'Electronics', rating: 4.9, tags: ['watch', 'smartwatch', 'apple'] },
    { id: 'n6', name: 'Colorblock Hooded Windbreaker', price: '₹1,899', image: 'https://images.unsplash.com/photo-1514090458221-65bb69cf63e6?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.7, gender: 'Kids', tags: ['jacket', 'kids', 'windbreaker', 'clothing'] },
    { id: 'n7', name: 'Floral Print Tulle Dress', price: '₹1,499', image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.8, gender: 'Kids', tags: ['dress', 'kids', 'floral', 'clothing'] },
    { id: 'n8', name: 'Revolution 6 Sneakers', price: '₹2,999', image: 'https://images.unsplash.com/photo-1514989940723-e8e51635b782?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.5, gender: 'Kids', tags: ['shoes', 'kids', 'sneakers'] },

    // Offers
    { id: 'o1', name: 'Girls Printed Top with Shorts', price: '₹413', image: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.4, gender: 'Kids', tags: ['kids', 'clothing', 'top'] },
    { id: 'o2', name: 'Oversized Cotton Co-Ords', price: '₹1,699', image: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.2, gender: 'Men', tags: ['mens', 'coords', 'streetwear'] },
    { id: 'o3', name: 'Sheath Midi Dress', price: '₹593', image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 3.9, gender: 'Women', tags: ['womens', 'dress', 'midi'] },
    { id: 'o4', name: 'Season Staples Knitted Dress', price: '₹1,439', image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.1, gender: 'Women', tags: ['womens', 'dress', 'knitted'] },
    { id: 'o5', name: 'Boys Ethnic Wear Set', price: '₹899', image: 'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.5, gender: 'Kids', tags: ['kids', 'ethnic', 'traditional'] },
    { id: 'o18', name: 'Boys Cotton Shorts Pack', price: '₹599', image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.3, gender: 'Kids', tags: ['kids', 'shorts', 'cotton'] },
    { id: 'o19', name: 'Women Striped Kurti', price: '₹399', image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.1, gender: 'Women', tags: ['womens', 'kurti', 'traditional'] },
    { id: 'o22', name: 'Baby Girls Flower Dress', price: '₹799', image: 'https://images.unsplash.com/photo-1555009393-f20bdb245c4d?auto=format&fit=crop&q=80&w=600', category: 'Fashion', rating: 4.8, gender: 'Kids', tags: ['kids', 'dress', 'floral'] }
];
