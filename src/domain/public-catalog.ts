import type { Category } from './types';

export interface PublicCatalogEntry {
  readonly slug: string;
  readonly name_it: string;
  readonly name_en: string;
  readonly category: Category;
  readonly icon: string;
}

export const PUBLIC_CATALOG: ReadonlyArray<PublicCatalogEntry> = [
  // fruit_vegetables
  { slug: 'mela', name_it: 'Mela', name_en: 'Apple', category: 'fruit_vegetables', icon: '🍎' },
  { slug: 'banana', name_it: 'Banana', name_en: 'Banana', category: 'fruit_vegetables', icon: '🍌' },
  { slug: 'arancia', name_it: 'Arancia', name_en: 'Orange', category: 'fruit_vegetables', icon: '🍊' },
  { slug: 'limone', name_it: 'Limone', name_en: 'Lemon', category: 'fruit_vegetables', icon: '🍋' },
  { slug: 'mandarino', name_it: 'Mandarino', name_en: 'Mandarin', category: 'fruit_vegetables', icon: '🍊' },
  { slug: 'pera', name_it: 'Pera', name_en: 'Pear', category: 'fruit_vegetables', icon: '🍐' },
  { slug: 'pesca', name_it: 'Pesca', name_en: 'Peach', category: 'fruit_vegetables', icon: '🍑' },
  { slug: 'albicocca', name_it: 'Albicocca', name_en: 'Apricot', category: 'fruit_vegetables', icon: '🍑' },
  { slug: 'ciliegia', name_it: 'Ciliegia', name_en: 'Cherry', category: 'fruit_vegetables', icon: '🍒' },
  { slug: 'fragola', name_it: 'Fragola', name_en: 'Strawberry', category: 'fruit_vegetables', icon: '🍓' },
  { slug: 'mirtillo', name_it: 'Mirtillo', name_en: 'Blueberry', category: 'fruit_vegetables', icon: '🫐' },
  { slug: 'lampone', name_it: 'Lampone', name_en: 'Raspberry', category: 'fruit_vegetables', icon: '🍓' },
  { slug: 'uva', name_it: 'Uva', name_en: 'Grapes', category: 'fruit_vegetables', icon: '🍇' },
  { slug: 'kiwi', name_it: 'Kiwi', name_en: 'Kiwi', category: 'fruit_vegetables', icon: '🥝' },
  { slug: 'ananas', name_it: 'Ananas', name_en: 'Pineapple', category: 'fruit_vegetables', icon: '🍍' },
  { slug: 'anguria', name_it: 'Anguria', name_en: 'Watermelon', category: 'fruit_vegetables', icon: '🍉' },
  { slug: 'melone', name_it: 'Melone', name_en: 'Melon', category: 'fruit_vegetables', icon: '🍈' },
  { slug: 'avocado', name_it: 'Avocado', name_en: 'Avocado', category: 'fruit_vegetables', icon: '🥑' },
  { slug: 'pomodoro', name_it: 'Pomodoro', name_en: 'Tomato', category: 'fruit_vegetables', icon: '🍅' },
  { slug: 'pomodorino', name_it: 'Pomodorini', name_en: 'Cherry tomatoes', category: 'fruit_vegetables', icon: '🍅' },
  { slug: 'pelati', name_it: 'Pomodori pelati', name_en: 'Peeled tomatoes', category: 'fruit_vegetables', icon: '🥫' },
  { slug: 'passata', name_it: 'Passata di pomodoro', name_en: 'Tomato passata', category: 'fruit_vegetables', icon: '🥫' },
  { slug: 'cetriolo', name_it: 'Cetriolo', name_en: 'Cucumber', category: 'fruit_vegetables', icon: '🥒' },
  { slug: 'zucchina', name_it: 'Zucchine', name_en: 'Zucchini', category: 'fruit_vegetables', icon: '🥒' },
  { slug: 'melanzana', name_it: 'Melanzana', name_en: 'Eggplant', category: 'fruit_vegetables', icon: '🍆' },
  { slug: 'peperone', name_it: 'Peperone', name_en: 'Bell pepper', category: 'fruit_vegetables', icon: '🫑' },
  { slug: 'carota', name_it: 'Carote', name_en: 'Carrots', category: 'fruit_vegetables', icon: '🥕' },
  { slug: 'patata', name_it: 'Patate', name_en: 'Potatoes', category: 'fruit_vegetables', icon: '🥔' },
  { slug: 'cipolla', name_it: 'Cipolla', name_en: 'Onion', category: 'fruit_vegetables', icon: '🧅' },
  { slug: 'aglio', name_it: 'Aglio', name_en: 'Garlic', category: 'fruit_vegetables', icon: '🧄' },
  { slug: 'insalata', name_it: 'Insalata', name_en: 'Lettuce', category: 'fruit_vegetables', icon: '🥬' },
  { slug: 'spinaci', name_it: 'Spinaci', name_en: 'Spinach', category: 'fruit_vegetables', icon: '🥬' },
  { slug: 'rucola', name_it: 'Rucola', name_en: 'Arugula', category: 'fruit_vegetables', icon: '🥬' },
  { slug: 'broccolo', name_it: 'Broccoli', name_en: 'Broccoli', category: 'fruit_vegetables', icon: '🥦' },
  { slug: 'cavolfiore', name_it: 'Cavolfiore', name_en: 'Cauliflower', category: 'fruit_vegetables', icon: '🥦' },
  { slug: 'sedano', name_it: 'Sedano', name_en: 'Celery', category: 'fruit_vegetables', icon: '🥬' },
  { slug: 'finocchio', name_it: 'Finocchio', name_en: 'Fennel', category: 'fruit_vegetables', icon: '🌿' },
  { slug: 'mais', name_it: 'Mais', name_en: 'Corn', category: 'fruit_vegetables', icon: '🌽' },
  { slug: 'mais-scatola', name_it: 'Mais in scatola', name_en: 'Canned corn', category: 'fruit_vegetables', icon: '🥫' },
  { slug: 'funghi', name_it: 'Funghi', name_en: 'Mushrooms', category: 'fruit_vegetables', icon: '🍄' },
  { slug: 'fagioli', name_it: 'Fagioli', name_en: 'Beans', category: 'fruit_vegetables', icon: '🫘' },
  { slug: 'ceci', name_it: 'Ceci', name_en: 'Chickpeas', category: 'fruit_vegetables', icon: '🫘' },
  { slug: 'lenticchie', name_it: 'Lenticchie', name_en: 'Lentils', category: 'fruit_vegetables', icon: '🫘' },
  { slug: 'piselli-scatola', name_it: 'Piselli in scatola', name_en: 'Canned peas', category: 'fruit_vegetables', icon: '🥫' },
  { slug: 'olive', name_it: 'Olive', name_en: 'Olives', category: 'fruit_vegetables', icon: '🫒' },
  { slug: 'capperi', name_it: 'Capperi', name_en: 'Capers', category: 'fruit_vegetables', icon: '🌿' },
  { slug: 'basilico', name_it: 'Basilico', name_en: 'Basil', category: 'fruit_vegetables', icon: '🌿' },
  { slug: 'prezzemolo', name_it: 'Prezzemolo', name_en: 'Parsley', category: 'fruit_vegetables', icon: '🌿' },
  { slug: 'rosmarino', name_it: 'Rosmarino', name_en: 'Rosemary', category: 'fruit_vegetables', icon: '🌿' },
  { slug: 'salvia', name_it: 'Salvia', name_en: 'Sage', category: 'fruit_vegetables', icon: '🌿' },
  { slug: 'origano', name_it: 'Origano', name_en: 'Oregano', category: 'fruit_vegetables', icon: '🌿' },
  { slug: 'peperoncino', name_it: 'Peperoncino', name_en: 'Chili pepper', category: 'fruit_vegetables', icon: '🌶️' },
  { slug: 'zenzero', name_it: 'Zenzero', name_en: 'Ginger', category: 'fruit_vegetables', icon: '🌿' },

  // dairy
  { slug: 'latte', name_it: 'Latte', name_en: 'Milk', category: 'dairy', icon: '🥛' },
  { slug: 'latte-scremato', name_it: 'Latte scremato', name_en: 'Skim milk', category: 'dairy', icon: '🥛' },
  { slug: 'latte-soia', name_it: 'Latte di soia', name_en: 'Soy milk', category: 'dairy', icon: '🥛' },
  { slug: 'latte-mandorla', name_it: 'Latte di mandorla', name_en: 'Almond milk', category: 'dairy', icon: '🥛' },
  { slug: 'burro', name_it: 'Burro', name_en: 'Butter', category: 'dairy', icon: '🧈' },
  { slug: 'yogurt', name_it: 'Yogurt', name_en: 'Yogurt', category: 'dairy', icon: '🥣' },
  { slug: 'yogurt-greco', name_it: 'Yogurt greco', name_en: 'Greek yogurt', category: 'dairy', icon: '🥣' },
  { slug: 'panna', name_it: 'Panna', name_en: 'Cream', category: 'dairy', icon: '🥛' },
  { slug: 'mozzarella', name_it: 'Mozzarella', name_en: 'Mozzarella', category: 'dairy', icon: '🧀' },
  { slug: 'parmigiano', name_it: 'Parmigiano', name_en: 'Parmesan', category: 'dairy', icon: '🧀' },
  { slug: 'pecorino', name_it: 'Pecorino', name_en: 'Pecorino', category: 'dairy', icon: '🧀' },
  { slug: 'ricotta', name_it: 'Ricotta', name_en: 'Ricotta', category: 'dairy', icon: '🧀' },
  { slug: 'gorgonzola', name_it: 'Gorgonzola', name_en: 'Gorgonzola', category: 'dairy', icon: '🧀' },
  { slug: 'stracchino', name_it: 'Stracchino', name_en: 'Stracchino', category: 'dairy', icon: '🧀' },
  { slug: 'philadelphia', name_it: 'Formaggio spalmabile', name_en: 'Cream cheese', category: 'dairy', icon: '🧀' },
  { slug: 'uova', name_it: 'Uova', name_en: 'Eggs', category: 'dairy', icon: '🥚' },

  // meat
  { slug: 'pollo', name_it: 'Pollo', name_en: 'Chicken', category: 'meat', icon: '🍗' },
  { slug: 'petto-pollo', name_it: 'Petto di pollo', name_en: 'Chicken breast', category: 'meat', icon: '🍗' },
  { slug: 'coscia-pollo', name_it: 'Cosce di pollo', name_en: 'Chicken thighs', category: 'meat', icon: '🍗' },
  { slug: 'ali-pollo', name_it: 'Ali di pollo', name_en: 'Chicken wings', category: 'meat', icon: '🍗' },
  { slug: 'tacchino', name_it: 'Tacchino', name_en: 'Turkey', category: 'meat', icon: '🦃' },
  { slug: 'fettine-tacchino', name_it: 'Fettine di tacchino', name_en: 'Turkey slices', category: 'meat', icon: '🍗' },
  { slug: 'manzo', name_it: 'Manzo', name_en: 'Beef', category: 'meat', icon: '🥩' },
  { slug: 'fettine-manzo', name_it: 'Fettine di manzo', name_en: 'Beef slices', category: 'meat', icon: '🥩' },
  { slug: 'macinato', name_it: 'Carne macinata', name_en: 'Ground beef', category: 'meat', icon: '🥩' },
  { slug: 'hamburger', name_it: 'Hamburger', name_en: 'Hamburger', category: 'meat', icon: '🍔' },
  { slug: 'polpette', name_it: 'Polpette', name_en: 'Meatballs', category: 'meat', icon: '🍡' },
  { slug: 'bistecca', name_it: 'Bistecca', name_en: 'Steak', category: 'meat', icon: '🥩' },
  { slug: 'arrosto', name_it: 'Arrosto', name_en: 'Roast', category: 'meat', icon: '🥩' },
  { slug: 'maiale', name_it: 'Maiale', name_en: 'Pork', category: 'meat', icon: '🥩' },
  { slug: 'lonza', name_it: 'Lonza di maiale', name_en: 'Pork loin', category: 'meat', icon: '🥩' },
  { slug: 'costine', name_it: 'Costine', name_en: 'Pork ribs', category: 'meat', icon: '🥩' },
  { slug: 'salsiccia', name_it: 'Salsiccia', name_en: 'Sausage', category: 'meat', icon: '🌭' },
  { slug: 'wurstel', name_it: 'Würstel', name_en: 'Hot dogs', category: 'meat', icon: '🌭' },
  { slug: 'pancetta', name_it: 'Pancetta', name_en: 'Bacon', category: 'meat', icon: '🥓' },
  { slug: 'guanciale', name_it: 'Guanciale', name_en: 'Guanciale', category: 'meat', icon: '🥓' },
  { slug: 'prosciutto-cotto', name_it: 'Prosciutto cotto', name_en: 'Cooked ham', category: 'meat', icon: '🥓' },
  { slug: 'prosciutto-crudo', name_it: 'Prosciutto crudo', name_en: 'Prosciutto', category: 'meat', icon: '🥓' },
  { slug: 'bresaola', name_it: 'Bresaola', name_en: 'Bresaola', category: 'meat', icon: '🥩' },
  { slug: 'salame', name_it: 'Salame', name_en: 'Salami', category: 'meat', icon: '🥓' },
  { slug: 'mortadella', name_it: 'Mortadella', name_en: 'Mortadella', category: 'meat', icon: '🥓' },
  { slug: 'speck', name_it: 'Speck', name_en: 'Speck', category: 'meat', icon: '🥓' },
  { slug: 'coniglio', name_it: 'Coniglio', name_en: 'Rabbit', category: 'meat', icon: '🐰' },
  { slug: 'agnello', name_it: 'Agnello', name_en: 'Lamb', category: 'meat', icon: '🐑' },

  // fish
  { slug: 'tonno', name_it: 'Tonno', name_en: 'Tuna', category: 'fish', icon: '🐟' },
  { slug: 'tonno-scatola', name_it: 'Tonno in scatola', name_en: 'Canned tuna', category: 'fish', icon: '🥫' },
  { slug: 'salmone', name_it: 'Salmone', name_en: 'Salmon', category: 'fish', icon: '🐟' },
  { slug: 'salmone-affumicato', name_it: 'Salmone affumicato', name_en: 'Smoked salmon', category: 'fish', icon: '🐟' },
  { slug: 'merluzzo', name_it: 'Merluzzo', name_en: 'Cod', category: 'fish', icon: '🐟' },
  { slug: 'baccala', name_it: 'Baccalà', name_en: 'Salt cod', category: 'fish', icon: '🐟' },
  { slug: 'sgombro', name_it: 'Sgombro', name_en: 'Mackerel', category: 'fish', icon: '🐟' },
  { slug: 'sardine', name_it: 'Sardine', name_en: 'Sardines', category: 'fish', icon: '🐟' },
  { slug: 'alici', name_it: 'Alici', name_en: 'Anchovies', category: 'fish', icon: '🐟' },
  { slug: 'orata', name_it: 'Orata', name_en: 'Sea bream', category: 'fish', icon: '🐟' },
  { slug: 'branzino', name_it: 'Branzino', name_en: 'Sea bass', category: 'fish', icon: '🐟' },
  { slug: 'trota', name_it: 'Trota', name_en: 'Trout', category: 'fish', icon: '🐟' },
  { slug: 'platessa', name_it: 'Platessa', name_en: 'Plaice', category: 'fish', icon: '🐟' },
  { slug: 'pesce-spada', name_it: 'Pesce spada', name_en: 'Swordfish', category: 'fish', icon: '🐟' },
  { slug: 'gamberi', name_it: 'Gamberi', name_en: 'Shrimp', category: 'fish', icon: '🦐' },
  { slug: 'gamberetti', name_it: 'Gamberetti', name_en: 'Prawns', category: 'fish', icon: '🦐' },
  { slug: 'scampi', name_it: 'Scampi', name_en: 'Langoustine', category: 'fish', icon: '🦐' },
  { slug: 'vongole', name_it: 'Vongole', name_en: 'Clams', category: 'fish', icon: '🦪' },
  { slug: 'cozze', name_it: 'Cozze', name_en: 'Mussels', category: 'fish', icon: '🦪' },
  { slug: 'calamari', name_it: 'Calamari', name_en: 'Squid', category: 'fish', icon: '🦑' },
  { slug: 'polpo', name_it: 'Polpo', name_en: 'Octopus', category: 'fish', icon: '🐙' },
  { slug: 'seppie', name_it: 'Seppie', name_en: 'Cuttlefish', category: 'fish', icon: '🦑' },
  { slug: 'surimi', name_it: 'Surimi', name_en: 'Surimi', category: 'fish', icon: '🍥' },

  // bakery
  { slug: 'pane', name_it: 'Pane', name_en: 'Bread', category: 'bakery', icon: '🍞' },
  { slug: 'pane-integrale', name_it: 'Pane integrale', name_en: 'Whole wheat bread', category: 'bakery', icon: '🍞' },
  { slug: 'baguette', name_it: 'Baguette', name_en: 'Baguette', category: 'bakery', icon: '🥖' },
  { slug: 'focaccia', name_it: 'Focaccia', name_en: 'Focaccia', category: 'bakery', icon: '🫓' },
  { slug: 'piadina', name_it: 'Piadina', name_en: 'Piadina', category: 'bakery', icon: '🫓' },
  { slug: 'grissini', name_it: 'Grissini', name_en: 'Breadsticks', category: 'bakery', icon: '🥖' },
  { slug: 'crackers', name_it: 'Crackers', name_en: 'Crackers', category: 'bakery', icon: '🍘' },
  { slug: 'fette-biscottate', name_it: 'Fette biscottate', name_en: 'Rusks', category: 'bakery', icon: '🍞' },
  { slug: 'biscotti', name_it: 'Biscotti', name_en: 'Cookies', category: 'bakery', icon: '🍪' },
  { slug: 'cornetto', name_it: 'Cornetto', name_en: 'Croissant', category: 'bakery', icon: '🥐' },
  { slug: 'brioche', name_it: 'Brioche', name_en: 'Brioche', category: 'bakery', icon: '🥐' },
  { slug: 'torta', name_it: 'Torta', name_en: 'Cake', category: 'bakery', icon: '🍰' },
  { slug: 'crostata', name_it: 'Crostata', name_en: 'Tart', category: 'bakery', icon: '🥧' },
  { slug: 'pasta', name_it: 'Pasta', name_en: 'Pasta', category: 'bakery', icon: '🍝' },
  { slug: 'spaghetti', name_it: 'Spaghetti', name_en: 'Spaghetti', category: 'bakery', icon: '🍝' },
  { slug: 'penne', name_it: 'Penne', name_en: 'Penne', category: 'bakery', icon: '🍝' },
  { slug: 'fusilli', name_it: 'Fusilli', name_en: 'Fusilli', category: 'bakery', icon: '🍝' },
  { slug: 'rigatoni', name_it: 'Rigatoni', name_en: 'Rigatoni', category: 'bakery', icon: '🍝' },
  { slug: 'lasagne', name_it: 'Lasagne', name_en: 'Lasagna', category: 'bakery', icon: '🍝' },
  { slug: 'gnocchi', name_it: 'Gnocchi', name_en: 'Gnocchi', category: 'bakery', icon: '🥟' },
  { slug: 'riso', name_it: 'Riso', name_en: 'Rice', category: 'bakery', icon: '🍚' },
  { slug: 'farina', name_it: 'Farina', name_en: 'Flour', category: 'bakery', icon: '🌾' },
  { slug: 'zucchero', name_it: 'Zucchero', name_en: 'Sugar', category: 'bakery', icon: '🥄' },
  { slug: 'sale', name_it: 'Sale', name_en: 'Salt', category: 'bakery', icon: '🧂' },
  { slug: 'pepe', name_it: 'Pepe', name_en: 'Pepper', category: 'bakery', icon: '🌶️' },
  { slug: 'lievito', name_it: 'Lievito', name_en: 'Yeast', category: 'bakery', icon: '🌾' },
  { slug: 'cioccolato', name_it: 'Cioccolato', name_en: 'Chocolate', category: 'bakery', icon: '🍫' },
  { slug: 'nutella', name_it: 'Nutella', name_en: 'Nutella', category: 'bakery', icon: '🍫' },
  { slug: 'marmellata', name_it: 'Marmellata', name_en: 'Jam', category: 'bakery', icon: '🍯' },
  { slug: 'miele', name_it: 'Miele', name_en: 'Honey', category: 'bakery', icon: '🍯' },
  { slug: 'cereali', name_it: 'Cereali', name_en: 'Cereal', category: 'bakery', icon: '🥣' },
  { slug: 'muesli', name_it: 'Muesli', name_en: 'Muesli', category: 'bakery', icon: '🥣' },
  { slug: 'pesto', name_it: 'Pesto', name_en: 'Pesto', category: 'bakery', icon: '🌿' },
  { slug: 'sugo-pronto', name_it: 'Sugo pronto', name_en: 'Pasta sauce', category: 'bakery', icon: '🥫' },
  { slug: 'maionese', name_it: 'Maionese', name_en: 'Mayonnaise', category: 'bakery', icon: '🥚' },
  { slug: 'ketchup', name_it: 'Ketchup', name_en: 'Ketchup', category: 'bakery', icon: '🍅' },
  { slug: 'senape', name_it: 'Senape', name_en: 'Mustard', category: 'bakery', icon: '🌭' },
  { slug: 'mandorle', name_it: 'Mandorle', name_en: 'Almonds', category: 'bakery', icon: '🌰' },
  { slug: 'noci', name_it: 'Noci', name_en: 'Walnuts', category: 'bakery', icon: '🌰' },
  { slug: 'nocciole', name_it: 'Nocciole', name_en: 'Hazelnuts', category: 'bakery', icon: '🌰' },
  { slug: 'pinoli', name_it: 'Pinoli', name_en: 'Pine nuts', category: 'bakery', icon: '🌰' },

  // beverages
  { slug: 'acqua', name_it: 'Acqua', name_en: 'Water', category: 'beverages', icon: '💧' },
  { slug: 'acqua-frizzante', name_it: 'Acqua frizzante', name_en: 'Sparkling water', category: 'beverages', icon: '💧' },
  { slug: 'caffe', name_it: 'Caffè', name_en: 'Coffee', category: 'beverages', icon: '☕' },
  { slug: 'caffe-macinato', name_it: 'Caffè macinato', name_en: 'Ground coffee', category: 'beverages', icon: '☕' },
  { slug: 'capsule-caffe', name_it: 'Capsule caffè', name_en: 'Coffee pods', category: 'beverages', icon: '☕' },
  { slug: 'te', name_it: 'Tè', name_en: 'Tea', category: 'beverages', icon: '🍵' },
  { slug: 'camomilla', name_it: 'Camomilla', name_en: 'Chamomile', category: 'beverages', icon: '🍵' },
  { slug: 'tisana', name_it: 'Tisana', name_en: 'Herbal tea', category: 'beverages', icon: '🍵' },
  { slug: 'succo-arancia', name_it: 'Succo d’arancia', name_en: 'Orange juice', category: 'beverages', icon: '🧃' },
  { slug: 'succo-mela', name_it: 'Succo di mela', name_en: 'Apple juice', category: 'beverages', icon: '🧃' },
  { slug: 'coca-cola', name_it: 'Coca-Cola', name_en: 'Coca-Cola', category: 'beverages', icon: '🥤' },
  { slug: 'aranciata', name_it: 'Aranciata', name_en: 'Orange soda', category: 'beverages', icon: '🥤' },
  { slug: 'birra', name_it: 'Birra', name_en: 'Beer', category: 'beverages', icon: '🍺' },
  { slug: 'vino-rosso', name_it: 'Vino rosso', name_en: 'Red wine', category: 'beverages', icon: '🍷' },
  { slug: 'vino-bianco', name_it: 'Vino bianco', name_en: 'White wine', category: 'beverages', icon: '🍷' },
  { slug: 'prosecco', name_it: 'Prosecco', name_en: 'Prosecco', category: 'beverages', icon: '🍾' },
  { slug: 'spumante', name_it: 'Spumante', name_en: 'Sparkling wine', category: 'beverages', icon: '🍾' },
  { slug: 'olio-oliva', name_it: 'Olio d’oliva', name_en: 'Olive oil', category: 'beverages', icon: '🫒' },
  { slug: 'aceto', name_it: 'Aceto', name_en: 'Vinegar', category: 'beverages', icon: '🧴' },
  { slug: 'aceto-balsamico', name_it: 'Aceto balsamico', name_en: 'Balsamic vinegar', category: 'beverages', icon: '🧴' },

  // frozen
  { slug: 'gelato', name_it: 'Gelato', name_en: 'Ice cream', category: 'frozen', icon: '🍨' },
  { slug: 'pizza-surgelata', name_it: 'Pizza surgelata', name_en: 'Frozen pizza', category: 'frozen', icon: '🍕' },
  { slug: 'verdure-surgelate', name_it: 'Verdure surgelate', name_en: 'Frozen vegetables', category: 'frozen', icon: '🥦' },
  { slug: 'piselli-surgelati', name_it: 'Piselli surgelati', name_en: 'Frozen peas', category: 'frozen', icon: '🟢' },
  { slug: 'spinaci-surgelati', name_it: 'Spinaci surgelati', name_en: 'Frozen spinach', category: 'frozen', icon: '🥬' },
  { slug: 'patatine-surgelate', name_it: 'Patatine surgelate', name_en: 'Frozen fries', category: 'frozen', icon: '🍟' },
  { slug: 'bastoncini-pesce', name_it: 'Bastoncini di pesce', name_en: 'Fish fingers', category: 'frozen', icon: '🐟' },
  { slug: 'pesce-surgelato', name_it: 'Pesce surgelato', name_en: 'Frozen fish', category: 'frozen', icon: '🐟' },
  { slug: 'frutti-bosco-surgelati', name_it: 'Frutti di bosco surgelati', name_en: 'Frozen berries', category: 'frozen', icon: '🫐' },
  { slug: 'ghiaccio', name_it: 'Ghiaccio', name_en: 'Ice', category: 'frozen', icon: '🧊' },
  { slug: 'sorbetto', name_it: 'Sorbetto', name_en: 'Sorbet', category: 'frozen', icon: '🍧' },
  { slug: 'minestrone-surgelato', name_it: 'Minestrone surgelato', name_en: 'Frozen minestrone', category: 'frozen', icon: '🍲' },

  // cleaning
  { slug: 'detersivo-piatti', name_it: 'Detersivo piatti', name_en: 'Dish soap', category: 'cleaning', icon: '🧼' },
  { slug: 'pastiglie-lavastoviglie', name_it: 'Pastiglie lavastoviglie', name_en: 'Dishwasher tabs', category: 'cleaning', icon: '🧼' },
  { slug: 'sale-lavastoviglie', name_it: 'Sale lavastoviglie', name_en: 'Dishwasher salt', category: 'cleaning', icon: '🧂' },
  { slug: 'brillantante', name_it: 'Brillantante', name_en: 'Rinse aid', category: 'cleaning', icon: '🧴' },
  { slug: 'detersivo-bucato', name_it: 'Detersivo bucato', name_en: 'Laundry detergent', category: 'cleaning', icon: '🧺' },
  { slug: 'ammorbidente', name_it: 'Ammorbidente', name_en: 'Fabric softener', category: 'cleaning', icon: '🧴' },
  { slug: 'candeggina', name_it: 'Candeggina', name_en: 'Bleach', category: 'cleaning', icon: '🧴' },
  { slug: 'sgrassatore', name_it: 'Sgrassatore', name_en: 'Degreaser', category: 'cleaning', icon: '🧴' },
  { slug: 'detergente-pavimenti', name_it: 'Detergente pavimenti', name_en: 'Floor cleaner', category: 'cleaning', icon: '🧴' },
  { slug: 'detergente-vetri', name_it: 'Detergente vetri', name_en: 'Glass cleaner', category: 'cleaning', icon: '🧴' },
  { slug: 'carta-igienica', name_it: 'Carta igienica', name_en: 'Toilet paper', category: 'cleaning', icon: '🧻' },
  { slug: 'scottex', name_it: 'Carta cucina', name_en: 'Paper towels', category: 'cleaning', icon: '🧻' },
  { slug: 'tovaglioli', name_it: 'Tovaglioli', name_en: 'Napkins', category: 'cleaning', icon: '🧻' },
  { slug: 'sacchi-spazzatura', name_it: 'Sacchi spazzatura', name_en: 'Trash bags', category: 'cleaning', icon: '🗑️' },
  { slug: 'spugne', name_it: 'Spugne', name_en: 'Sponges', category: 'cleaning', icon: '🧽' },
  { slug: 'guanti-lattice', name_it: 'Guanti in lattice', name_en: 'Latex gloves', category: 'cleaning', icon: '🧤' },
  { slug: 'pellicola-alimenti', name_it: 'Pellicola alimenti', name_en: 'Cling film', category: 'cleaning', icon: '🎞️' },
  { slug: 'carta-forno', name_it: 'Carta da forno', name_en: 'Baking paper', category: 'cleaning', icon: '📄' },
  { slug: 'alluminio', name_it: 'Carta alluminio', name_en: 'Aluminum foil', category: 'cleaning', icon: '🎞️' },

  // hygiene
  { slug: 'dentifricio', name_it: 'Dentifricio', name_en: 'Toothpaste', category: 'hygiene', icon: '🪥' },
  { slug: 'spazzolino', name_it: 'Spazzolino', name_en: 'Toothbrush', category: 'hygiene', icon: '🪥' },
  { slug: 'collutorio', name_it: 'Collutorio', name_en: 'Mouthwash', category: 'hygiene', icon: '🧴' },
  { slug: 'filo-interdentale', name_it: 'Filo interdentale', name_en: 'Dental floss', category: 'hygiene', icon: '🧵' },
  { slug: 'sapone', name_it: 'Sapone', name_en: 'Soap', category: 'hygiene', icon: '🧼' },
  { slug: 'bagnoschiuma', name_it: 'Bagnoschiuma', name_en: 'Shower gel', category: 'hygiene', icon: '🧴' },
  { slug: 'shampoo', name_it: 'Shampoo', name_en: 'Shampoo', category: 'hygiene', icon: '🧴' },
  { slug: 'balsamo', name_it: 'Balsamo', name_en: 'Conditioner', category: 'hygiene', icon: '🧴' },
  { slug: 'deodorante', name_it: 'Deodorante', name_en: 'Deodorant', category: 'hygiene', icon: '🧴' },
  { slug: 'rasoio', name_it: 'Rasoio', name_en: 'Razor', category: 'hygiene', icon: '🪒' },
  { slug: 'schiuma-barba', name_it: 'Schiuma da barba', name_en: 'Shaving cream', category: 'hygiene', icon: '🧴' },
  { slug: 'crema-viso', name_it: 'Crema viso', name_en: 'Face cream', category: 'hygiene', icon: '🧴' },
  { slug: 'crema-corpo', name_it: 'Crema corpo', name_en: 'Body lotion', category: 'hygiene', icon: '🧴' },
  { slug: 'salviette', name_it: 'Salviette umidificate', name_en: 'Wet wipes', category: 'hygiene', icon: '🧻' },
  { slug: 'cotton-fioc', name_it: 'Cotton fioc', name_en: 'Cotton swabs', category: 'hygiene', icon: '🧴' },
  { slug: 'dischetti-struccanti', name_it: 'Dischetti struccanti', name_en: 'Cotton pads', category: 'hygiene', icon: '⚪' },
  { slug: 'assorbenti', name_it: 'Assorbenti', name_en: 'Sanitary pads', category: 'hygiene', icon: '🩸' },
  { slug: 'pannolini', name_it: 'Pannolini', name_en: 'Diapers', category: 'hygiene', icon: '👶' },
  { slug: 'profumo', name_it: 'Profumo', name_en: 'Perfume', category: 'hygiene', icon: '🌸' },

  // other (minimal — non-food, no clean home)
  { slug: 'pile-aa', name_it: 'Pile AA', name_en: 'AA batteries', category: 'other', icon: '🔋' },
  { slug: 'pile-aaa', name_it: 'Pile AAA', name_en: 'AAA batteries', category: 'other', icon: '🔋' },
  { slug: 'lampadina', name_it: 'Lampadina', name_en: 'Light bulb', category: 'other', icon: '💡' },
];

export const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

export const getPublicCatalogName = (
  entry: PublicCatalogEntry,
  locale: string,
): string => (locale.startsWith('it') ? entry.name_it : entry.name_en);

export const findPublicEntryByName = (
  name: string,
  locale: string,
): PublicCatalogEntry | undefined => {
  const target = normalizeName(name);
  return PUBLIC_CATALOG.find(
    (e) => normalizeName(getPublicCatalogName(e, locale)) === target,
  );
};

export const GENERIC_ITEM_ICON = '📦';

export const iconForName = (name: string, locale: string): string => {
  const entry = findPublicEntryByName(name, locale);
  return entry?.icon ?? GENERIC_ITEM_ICON;
};

export const isCustomItemName = (name: string, _locale?: string): boolean => {
  const target = normalizeName(name);
  if (!target) return false;
  return !PUBLIC_CATALOG.some(
    (e) =>
      normalizeName(e.name_it) === target || normalizeName(e.name_en) === target,
  );
};
