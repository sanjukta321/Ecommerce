import React from 'react';
import CategoryListingPage from '../components/CategoryListingPage';

const Accessories: React.FC = () => (
  <CategoryListingPage
    titlePrefix="Luxury"
    titleHighlight="Accents"
    subtitle="The defining details of a sophisticated lifestyle"
    frappeCategory="Accessories"
    subcategories={['All', 'Watches', 'Sunglasses', 'Bags', 'Jewellery']}
    keywords={{
      watches:    ['watch', 'chronograph', 'smartwatch', 'timepiece', 'fastrack', 'titan'],
      sunglasses: ['sunglass', 'polarized', 'aviator', 'shade', 'uv', 'wayfarer', 'ray-ban'],
      bags:       ['bag', 'handbag', 'tote', 'backpack', 'clutch', 'purse', 'sling'],
      jewellery:  ['jewellery', 'jewelry', 'necklace', 'ring', 'bracelet', 'earring', 'gold', 'diamond', 'signature jewellery', 'collection'],
    }}
  />
);

export default Accessories;
