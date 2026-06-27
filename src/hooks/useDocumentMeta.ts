import { useEffect } from 'react';

interface MetaData {
  title?: string;
  description?: string;
  category?: string;
}

export function useDocumentMeta({ title, description, category }: MetaData) {
  useEffect(() => {
    // 1. Build dynamic title
    const baseTitle = "Toolsmart";
    const segment = category ? `[${category.toUpperCase()}] ` : '';
    const fullTitle = title 
      ? `${segment}${title} | ${baseTitle}` 
      : `${baseTitle} - 110,000+ Fast & Free Utility Tools & Calculators`;

    document.title = fullTitle;

    // 2. Build dynamic description
    const fullDesc = description || "Access over 1,000+ lightning-fast, high-utility, search-optimized calculators, unit converters, developers formatters, and financial math solvers.";

    // Helper to update or create a meta tag
    const updateMetaTag = (attributeName: string, attributeValue: string, content: string) => {
      let element = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attributeName, attributeValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Update standard meta tags
    updateMetaTag('name', 'description', fullDesc);

    // Update Open Graph tags for social sharing
    updateMetaTag('property', 'og:title', fullTitle);
    updateMetaTag('property', 'og:description', fullDesc);

    // Update Twitter Card tags
    updateMetaTag('name', 'twitter:title', fullTitle);
    updateMetaTag('name', 'twitter:description', fullDesc);

  }, [title, description, category]);
}
