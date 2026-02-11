'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Laptop, Shirt, Home, Dumbbell, BookOpen, Gamepad2, Car, Diamond,
} from 'lucide-react';

const categories = [
  { name: 'Electronics', icon: Laptop, slug: 'electronics' },
  { name: 'Fashion', icon: Shirt, slug: 'fashion' },
  { name: 'Home & Garden', icon: Home, slug: 'home' },
  { name: 'Sports', icon: Dumbbell, slug: 'sports' },
  { name: 'Books', icon: BookOpen, slug: 'books' },
  { name: 'Gaming', icon: Gamepad2, slug: 'toys' },
  { name: 'Automotive', icon: Car, slug: 'automotive' },
  { name: 'Jewelry', icon: Diamond, slug: 'jewelry' },
];

export function CategoriesSection() {
  return (
    <section className="py-10">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            Browse by <span className="text-gradient-primary">Category</span>
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Discover products across all categories. Pay with your favorite cryptocurrency.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map((cat, index) => (
            <motion.div
              key={cat.slug}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.04 }}
            >
              <Link href={`/products?category=${cat.slug}`}>
                <div className="group bg-card rounded-xl border border-border p-4 text-center hover:border-primary/30 hover:shadow-md transition-all cursor-pointer">
                  <div className="w-10 h-10 mx-auto mb-2.5 rounded-lg bg-ocean-50 dark:bg-ocean-900/20 flex items-center justify-center group-hover:bg-ocean-100 dark:group-hover:bg-ocean-800/30 transition-colors">
                    <cat.icon className="w-5 h-5 text-ocean-600 dark:text-ocean-400" />
                  </div>
                  <h3 className="font-medium text-sm group-hover:text-primary transition-colors">
                    {cat.name}
                  </h3>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
