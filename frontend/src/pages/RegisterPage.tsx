import { Navigate } from 'react-router-dom';

// Signup is now integrated into the Login page
const RegisterPage = () => <Navigate to="/login" replace />;

export default RegisterPage;
