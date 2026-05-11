import React from 'react';
import CategoryListingPage from '../components/CategoryListingPage';

const Electronics: React.FC = () => (
  <CategoryListingPage
    titlePrefix="Tech"
    titleHighlight="Innovations"
    subtitle="Experience the future with our premium electronics"
    frappeCategory="Electronics"
    subcategories={['All', 'Mobile', 'Laptop', 'Headphones', 'Watch', 'TV', 'Appliance']}
    keywords={{
      mobile:     ['mobile', 'phone', 'iphone', 'samsung', 'smartphone', 'android'],
      laptop:     ['laptop', 'macbook', 'notebook', 'computer', 'chromebook'],
      headphones: ['headphone', 'earphone', 'earbuds', 'headset', 'wh-', 'airpod'],
      watch:      ['watch', 'smartwatch'],
      tv:         ['tv', 'television', 'qled', 'oled', 'smart tv', 'led tv'],
      appliance:  ['appliance', 'washer', 'washing', 'refrigerator', 'fridge', 'microwave'],
    }}
  />
);

export default Electronics;
