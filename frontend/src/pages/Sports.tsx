import React from 'react';
import CategoryListingPage from '../components/CategoryListingPage';

const Sports: React.FC = () => (
  <CategoryListingPage
    titlePrefix="Elite"
    titleHighlight="Performers"
    subtitle="Professional gear for the uncompromising athlete"
    frappeCategory="Sports"
    subcategories={['All', 'Cricket', 'Football', 'Gym', 'Tennis']}
    keywords={{
      cricket:  ['cricket', 'willow', 'bat', 'stump', 'crease'],
      football: ['football', 'soccer', 'cleats', 'futsal', 'striker'],
      gym:      ['gym', 'fitness', 'treadmill', 'dumbbell', 'barbell', 'workout', 'essentials kit'],
      tennis:   ['tennis', 'racket', 'badminton', 'graphite'],
    }}
  />
);

export default Sports;
