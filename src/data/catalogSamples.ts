import catBackpack from '../assets/images/cat_backpack_1794774389556.jpg';
import catBurger from '../assets/images/cat_burger_1794774386629.jpg';
import catCake from '../assets/images/cat_cake_1794774389136.jpg';
import catCamera from '../assets/images/cat_camera_1794774387996.jpg';
import catChair from '../assets/images/cat_chair_1794774388745.jpg';
import catCoffee from '../assets/images/cat_coffee_1794774387098.jpg';
import catHeadphones from '../assets/images/cat_headphones_1794774386382.jpg';
import catMug from '../assets/images/cat_mug_1794774389939.jpg';
import catPerfume from '../assets/images/cat_perfume_1794774388613.jpg';
import catPizza from '../assets/images/cat_pizza_1794774388665.jpg';
import catPlant from '../assets/images/cat_plant_1794774389702.jpg';
import catSneaker from '../assets/images/cat_sneaker_1794774385326.jpg';
import catSunglasses from '../assets/images/cat_sunglasses_1794774388676.jpg';
import catSushi from '../assets/images/cat_sushi_1794774388442.jpg';
import catWatch from '../assets/images/cat_watch_1794774386848.jpg';

export interface CatalogImageItem {
  id: string;
  url: string;
  cleanUrl: string;
  sourcePageUrl?: string;
  alt: string;
  originalBytes?: number;
  compressedBytes?: number;
  savedPercent?: number;
}

export const CATALOG_SAMPLE_IMAGES: CatalogImageItem[] = [
  {
    id: 'sneaker',
    url: catSneaker,
    cleanUrl: 'https://cdn.urllimpia.com/zapatilla-cuero.jpg',
    alt: 'Zapatilla minimalista de cuero blanco',
  },
  {
    id: 'burger',
    url: catBurger,
    cleanUrl: 'https://cdn.urllimpia.com/hamburguesa-artesanal.jpg',
    alt: 'Hamburguesa artesanal con queso cheddar',
  },
  {
    id: 'headphones',
    url: catHeadphones,
    cleanUrl: 'https://cdn.urllimpia.com/audifonos-mate.jpg',
    alt: 'Audífonos inalámbricos negros mate',
  },
  {
    id: 'coffee',
    url: catCoffee,
    cleanUrl: 'https://cdn.urllimpia.com/cafe-latte.jpg',
    alt: 'Café latte frío en vaso de cristal',
  },
  {
    id: 'watch',
    url: catWatch,
    cleanUrl: 'https://cdn.urllimpia.com/reloj-cuero.jpg',
    alt: 'Reloj minimalista con correa de cuero',
  },
  {
    id: 'pizza',
    url: catPizza,
    cleanUrl: 'https://cdn.urllimpia.com/pizza-margarita.jpg',
    alt: 'Pizza margarita artesanal recién horneada',
  },
  {
    id: 'perfume',
    url: catPerfume,
    cleanUrl: 'https://cdn.urllimpia.com/perfume-ambar.jpg',
    alt: 'Frasco de perfume de vidrio ámbar',
  },
  {
    id: 'camera',
    url: catCamera,
    cleanUrl: 'https://cdn.urllimpia.com/camara-retro.jpg',
    alt: 'Cámara fotográfica compacta plateada y negra',
  },
  {
    id: 'sushi',
    url: catSushi,
    cleanUrl: 'https://cdn.urllimpia.com/nigiri-salmon.jpg',
    alt: 'Plato de nigiri de salmón fresco',
  },
  {
    id: 'chair',
    url: catChair,
    cleanUrl: 'https://cdn.urllimpia.com/silla-nordica.jpg',
    alt: 'Silla escandinava de roble y tela beige',
  },
  {
    id: 'sunglasses',
    url: catSunglasses,
    cleanUrl: 'https://cdn.urllimpia.com/gafas-carey.jpg',
    alt: 'Gafas de sol clásicas estilo carey',
  },
  {
    id: 'cake',
    url: catCake,
    cleanUrl: 'https://cdn.urllimpia.com/pastel-chocolate.jpg',
    alt: 'Porción de pastel de chocolate oscuro',
  },
  {
    id: 'backpack',
    url: catBackpack,
    cleanUrl: 'https://cdn.urllimpia.com/mochila-lona.jpg',
    alt: 'Mochila urbana de lona verde oliva',
  },
  {
    id: 'plant',
    url: catPlant,
    cleanUrl: 'https://cdn.urllimpia.com/planta-monstera.jpg',
    alt: 'Planta monstera en maceta de cerámica blanca',
  },
  {
    id: 'mug',
    url: catMug,
    cleanUrl: 'https://cdn.urllimpia.com/taza-ceramica.jpg',
    alt: 'Taza artesanal de cerámica moteada',
  },
];
