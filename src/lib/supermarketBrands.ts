export type SupermarketBrand = {
  name: string;
  color: string;
  lightBg: string;
  gradient: string;
  image: string;
  processingFee: number;
};

export const supermarketData: Record<string, SupermarketBrand> = {
  quickmart: {
    name: "Quickmart",
    color: "#E53935",
    lightBg: "#FFF5F5",
    gradient: "from-red-50 to-rose-50",
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRJBpIQCnYaXsDbJMWUazSeLBMI0wdWX2WOYHS4BWdhtZXRAmsnKsurFY4&s=10",
    processingFee: 160,
  },
  naivas: {
    name: "Naivas",
    color: "#4CAF50",
    lightBg: "#F0FFF4",
    gradient: "from-green-50 to-emerald-50",
    image: "https://thesharpdaily.com/wp-content/uploads/Naivas.jpg",
    processingFee: 150,
  },
  carrefour: {
    name: "Carrefour",
    color: "#1565C0",
    lightBg: "#EFF6FF",
    gradient: "from-blue-50 to-indigo-50",
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT5WgjjYd8DlNlZOHOWQ8aB9ol0Co9wtz2UvMZAd1LOk5N6ChFtC6EnLOw&s=10",
    processingFee: 140,
  },
  cleanshelf: {
    name: "Cleanshelf",
    color: "#43A047",
    lightBg: "#F0FFF4",
    gradient: "from-green-50 to-teal-50",
    image:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ8718MLGwQuQ8S3oiQpo-Nvou56-rBk8OmRyjIke8R-0VkH2IC1j8yeIE&s=10",
    processingFee: 145,
  },
};

export function getSupermarketBrand(slug?: string): SupermarketBrand {
  return supermarketData[slug || ""] || supermarketData.quickmart;
}
