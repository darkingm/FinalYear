import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';

const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;

