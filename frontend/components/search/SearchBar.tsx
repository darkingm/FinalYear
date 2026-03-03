'use client';

import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'keyword' | 'elastic'>('keyword');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const params = new URLSearchParams({
      q: query,
      mode: searchMode,
    });

    router.push(`/products?${params}`);
  };

  return (
    <form onSubmit={handleSearch} className="flex items-center gap-2 w-full max-w-2xl">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input
          type="text"
          placeholder="Search products, coins, or sellers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-4 h-12 text-base"
        />
      </div>
      
      <Button
        type="button"
        variant={searchMode === 'keyword' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setSearchMode(searchMode === 'keyword' ? 'elastic' : 'keyword')}
        className="flex items-center gap-2 whitespace-nowrap"
      >
        <Filter className="w-4 h-4" />
        {searchMode === 'keyword' ? 'Keyword' : 'Smart'}
      </Button>

      <Button type="submit" size="lg" className="h-12 px-6">
        Search
      </Button>
    </form>
  );
}
