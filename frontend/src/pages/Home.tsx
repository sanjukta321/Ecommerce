import React from 'react';
import Hero from '../components/Hero';
import CategoryStrip from '../components/CategoryStrip';
import FeaturedCategories from '../components/FeaturedCategories';
import Spotlight from '../components/Spotlight';
import TrendingNow from '../components/TrendingNow';
import FlashSale from '../components/FlashSale';
import Lookbook from '../components/Lookbook';
import BrandMarquee from '../components/BrandMarquee';
import NewArrivalsSection from '../components/NewArrivalsSection';
import ValueProps from '../components/ValueProps';
import SellerSection from '../components/SellerSection';
import Footer from '../components/Footer';
import '../styles/Home.css';

const Home: React.FC = () => {
    return (
        <div className="home-page">
            <Hero />
            <BrandMarquee />
            <CategoryStrip />
            <NewArrivalsSection />
            <FeaturedCategories />
            <Spotlight />
            <TrendingNow />
            <FlashSale />
            <Lookbook />
            <ValueProps />
            <SellerSection />
            <Footer />
        </div>
    );
};

export default Home;
