import React from 'react';
import CategoryListingPage from '../components/CategoryListingPage';

const Furniture: React.FC = () => (
  <CategoryListingPage
    titlePrefix="Premium"
    titleHighlight="Furniture"
    subtitle="Elegance for every corner of your home"
    frappeCategory="Furniture"
    subcategories={['All', 'Living Room', 'Bedroom', 'Dining', 'Office']}
    keywords={{
      'living room': ['sofa', 'couch', 'living', 'coffee table', 'ottoman', 'recliner', 'velvet', 'royal'],
      bedroom:       ['bed', 'bedroom', 'mattress', 'wardrobe', 'nightstand', 'walnut', 'carved'],
      dining:        ['dining', 'dinner table', 'scandi', 'dining set'],
      office:        ['office', 'ergonomic', 'desk', 'workstation', 'study table', 'executive'],
    }}
  />
);

export default Furniture;
