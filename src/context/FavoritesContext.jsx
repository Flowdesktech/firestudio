import React, { createContext, useContext, useState, useEffect } from 'react';

const FavoritesContext = createContext();

export function FavoritesProvider({ children }) {
    const [favorites, setFavorites] = useState(() => {
        try {
            const saved = localStorage.getItem('firefoo-favorites');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('firefoo-favorites', JSON.stringify(favorites));
    }, [favorites]);

    const addFavorite = (favorite) => {
        const newFavorite = {
            id: Date.now().toString(),
            ...favorite,
            createdAt: Date.now()
        };
        setFavorites(prev => [...prev, newFavorite]);
        return newFavorite;
    };

    const removeFavorite = (id) => {
        setFavorites(prev => prev.filter(f => f.id !== id));
    };

    const isFavorite = (projectId, collectionPath) => {
        return favorites.some(f => f.projectId === projectId && f.collectionPath === collectionPath);
    };

    const toggleFavorite = (projectId, projectName, collectionPath) => {
        const existing = favorites.find(f => f.projectId === projectId && f.collectionPath === collectionPath);
        if (existing) {
            removeFavorite(existing.id);
            return false;
        } else {
            addFavorite({ projectId, projectName, collectionPath });
            return true;
        }
    };

    return (
        <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite }}>
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites() {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error('useFavorites must be used within a FavoritesProvider');
    }
    return context;
}
