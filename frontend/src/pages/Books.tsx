import React from 'react';
import CategoryListingPage from '../components/CategoryListingPage';

const Books: React.FC = () => (
  <CategoryListingPage
    titlePrefix="Curated"
    titleHighlight="Library"
    subtitle="Expand your horizon with our collection of masterworks"
    frappeCategory="Books"
    subcategories={['All', 'Fiction', 'Non-Fiction', 'Academic']}
    keywords={{
      fiction:       ['fiction', 'novel', 'story', 'thriller', 'mystery', 'fantasy'],
      'non-fiction': ['science', 'cosmos', 'cooking', 'map', 'architecture', 'history', 'vintage', 'art of'],
      academic:      ['academic', 'textbook', 'engineering', 'mathematics', 'study', 'ncert', 'physics', 'chemistry'],
    }}
  />
);

export default Books;
