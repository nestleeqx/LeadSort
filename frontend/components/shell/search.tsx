"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Search = { q: string; setQ: (q: string) => void };

const SearchContext = createContext<Search>({ q: "", setQ: () => {} });

/** Поиск по заявкам живёт в верхней панели, а фильтрует доску — общее состояние для обоих. */
export function SearchProvider({ children }: { children: ReactNode }) {
  const [q, setQ] = useState("");
  return <SearchContext.Provider value={{ q, setQ }}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  return useContext(SearchContext);
}
