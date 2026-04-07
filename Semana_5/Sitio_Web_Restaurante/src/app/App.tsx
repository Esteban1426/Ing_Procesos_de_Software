import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { router } from './routes';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          richColors={false}
          toastOptions={{
            style: { fontFamily: 'inherit' },
          }}
        />
      </CartProvider>
    </AuthProvider>
  );
}