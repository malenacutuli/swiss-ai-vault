import { StyleConfig, SlideStyleName } from '@/types/slides';

// =============================================
// 15 STYLE CONFIGURATIONS (MANUS PARITY)
// =============================================

export const SLIDE_STYLES: Record<SlideStyleName, StyleConfig> = {
  vinyl: {
    name: 'vinyl',
    displayName: 'Vinyl',
    description: 'Retro vinyl record aesthetic with warm, nostalgic colors',
    bestFor: 'Music, creative presentations, entertainment',
    colors: {
      background: '#1a1a1a',
      primary: '#d4af37',
      secondary: '#8b7355',
      accent: '#cd853f',
      text: '#f5f5dc',
      muted: '#a0a0a0',
    },
    fonts: {
      headline: "'Playfair Display', serif",
      body: "'Lato', sans-serif",
      accent: "'Bebas Neue', sans-serif",
    },
    promptTemplate: '{content}, vinyl record aesthetic, retro album cover style, circular grooves pattern, warm golden lighting, vintage typography, 1970s music industry aesthetic, high contrast, dramatic shadows, black background with gold accents, professional presentation slide',
    negativePrompt: 'modern, digital, cold colors, blue tones, minimalist, flat design, corporate, sterile, bright white, neon',
    modifiers: ['vinyl record texture', 'album cover composition', 'retro typography', 'warm color grading', 'circular design elements', 'gold foil accents', 'vintage paper texture', 'dramatic lighting'],
    effects: [{ type: 'vignette', intensity: 0.3 }, { type: 'grain', intensity: 0.1 }],
  },

  whiteboard: {
    name: 'whiteboard',
    displayName: 'Whiteboard',
    description: 'Hand-drawn sketch aesthetic with marker strokes',
    bestFor: 'Education, workshops, brainstorming',
    colors: {
      background: '#f8f8f8',
      primary: '#2c3e50',
      secondary: '#e74c3c',
      accent: '#3498db',
      text: '#34495e',
      muted: '#95a5a6',
    },
    fonts: {
      headline: "'Permanent Marker', cursive",
      body: "'Patrick Hand', cursive",
      accent: "'Architects Daughter', cursive",
    },
    promptTemplate: '{content}, whiteboard sketch style, hand-drawn marker illustration, educational diagram, colorful annotations, clean white background, dry erase marker aesthetic, informal sketchy lines, workshop presentation, brainstorming session visual',
    negativePrompt: 'photorealistic, 3D render, dark background, formal, corporate, polished, perfect lines, digital art, gradient, glossy',
    modifiers: ['hand-drawn lines', 'marker stroke texture', 'sketch annotations', 'sticky note elements', 'arrow indicators', 'circle highlights', 'underline emphasis', 'doodle decorations'],
  },

  grove: {
    name: 'grove',
    displayName: 'Grove',
    description: 'Natural, organic aesthetic with earth tones',
    bestFor: 'Environmental, wellness, sustainability',
    colors: {
      background: '#f5f0e6',
      primary: '#2d5a27',
      secondary: '#8b7355',
      accent: '#d4a574',
      text: '#3d3d3d',
      muted: '#a0a0a0',
    },
    fonts: {
      headline: "'Cormorant Garamond', serif",
      body: "'Source Sans Pro', sans-serif",
      accent: "'Amatic SC', cursive",
    },
    promptTemplate: '{content}, natural forest aesthetic, organic shapes, botanical illustration style, earth tones, leaf patterns, sustainable design, eco-friendly presentation, wooden textures, morning light through trees, peaceful nature scene',
    negativePrompt: 'urban, industrial, artificial, neon, plastic, synthetic, harsh lighting, concrete, metal, technology, digital',
    modifiers: ['botanical elements', 'leaf patterns', 'wood grain texture', 'natural lighting', 'organic shapes', 'earth tone palette', 'forest atmosphere', 'sustainable aesthetic'],
  },

  fresco: {
    name: 'fresco',
    displayName: 'Fresco',
    description: 'Classical Renaissance painting aesthetic',
    bestFor: 'Art, history, luxury brands',
    colors: {
      background: '#f4e9d9',
      primary: '#8b4513',
      secondary: '#556b2f',
      accent: '#b8860b',
      text: '#3c2415',
      muted: '#8b7355',
    },
    fonts: {
      headline: "'Cinzel', serif",
      body: "'EB Garamond', serif",
      accent: "'Cormorant', serif",
    },
    promptTemplate: '{content}, Renaissance fresco painting style, classical art aesthetic, aged plaster texture, rich earth pigments, museum quality artwork, Michelangelo inspired, Sistine Chapel style, dramatic composition, chiaroscuro lighting, old master painting technique',
    negativePrompt: 'modern, digital, minimalist, flat colors, cartoon, anime, bright neon, plastic, glossy, contemporary, abstract',
    modifiers: ['fresco texture', 'classical composition', 'Renaissance style', 'aged patina', 'rich pigments', 'dramatic lighting', 'museum quality', 'old master technique'],
  },

  easel: {
    name: 'easel',
    displayName: 'Easel',
    description: 'Artist studio aesthetic with canvas textures',
    bestFor: 'Creative, design, artistic presentations',
    colors: {
      background: '#f5f1eb',
      primary: '#1a1a2e',
      secondary: '#c44536',
      accent: '#f7b32b',
      text: '#2d2d2d',
      muted: '#666666',
    },
    fonts: {
      headline: "'Libre Baskerville', serif",
      body: "'Open Sans', sans-serif",
      accent: "'Dancing Script', cursive",
    },
    promptTemplate: '{content}, artist easel studio setting, oil painting on canvas, visible brush strokes, paint palette colors, creative workspace, impressionist style, artistic expression, gallery quality, natural studio lighting',
    negativePrompt: 'digital art, vector, flat design, corporate, sterile, perfect lines, photorealistic, 3D render, minimalist',
    modifiers: ['canvas texture', 'brush stroke visible', 'oil paint effect', 'artist studio', 'palette knife texture', 'impasto technique', 'gallery lighting', 'wooden frame'],
  },

  diorama: {
    name: 'diorama',
    displayName: 'Diorama',
    description: '3D miniature scene with tilt-shift effect',
    bestFor: 'Product demos, storytelling, architecture',
    colors: {
      background: '#e8e4df',
      primary: '#4a4a4a',
      secondary: '#7c9885',
      accent: '#d4a574',
      text: '#333333',
      muted: '#888888',
    },
    fonts: {
      headline: "'Montserrat', sans-serif",
      body: "'Nunito', sans-serif",
      accent: "'Roboto Mono', monospace",
    },
    promptTemplate: '{content}, miniature diorama scene, tilt-shift photography, 3D paper craft aesthetic, layered depth, tiny world perspective, handmade model feel, soft shadows, shallow depth of field, museum display quality',
    negativePrompt: 'flat, 2D, illustration, cartoon, full scale, realistic scale, harsh lighting, no depth, single layer, digital flat',
    modifiers: ['miniature scale', 'tilt-shift blur', 'layered depth', 'paper craft texture', 'soft shadows', 'display case', 'handmade aesthetic', 'scene composition'],
  },

  chromatic: {
    name: 'chromatic',
    displayName: 'Chromatic',
    description: 'Bold color gradients with modern tech feel',
    bestFor: 'Technology, startups, modern brands',
    colors: {
      background: '#0f0f1a',
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#f093fb',
      text: '#ffffff',
      muted: '#a0a0a0',
    },
    fonts: {
      headline: "'Poppins', sans-serif",
      body: "'Inter', sans-serif",
      accent: "'Space Grotesk', sans-serif",
    },
    promptTemplate: '{content}, bold chromatic gradient background, modern tech aesthetic, vibrant color transitions, futuristic design, glowing elements, abstract geometric shapes, dynamic composition, high contrast, digital art style, sleek and modern',
    negativePrompt: 'muted colors, vintage, retro, aged, natural, organic, earth tones, brown, beige, traditional, classical',
    modifiers: ['gradient background', 'vibrant colors', 'geometric shapes', 'glow effects', 'modern aesthetic', 'tech style', 'dynamic composition', 'high contrast'],
  },

  sketch: {
    name: 'sketch',
    displayName: 'Sketch',
    description: 'Pencil drawing with conceptual draft feel',
    bestFor: 'Concepts, proposals, architectural presentations',
    colors: {
      background: '#faf9f7',
      primary: '#2c2c2c',
      secondary: '#666666',
      accent: '#b8860b',
      text: '#333333',
      muted: '#999999',
    },
    fonts: {
      headline: "'Architects Daughter', cursive",
      body: "'Caveat', cursive",
      accent: "'Indie Flower', cursive",
    },
    promptTemplate: '{content}, pencil sketch illustration, graphite drawing style, architectural concept sketch, hand-drawn lines, paper texture, technical drawing aesthetic, blueprint feel, draft presentation, cross-hatching shading',
    negativePrompt: 'color, painted, digital, polished, finished, photorealistic, 3D render, glossy, vibrant, saturated, cartoon',
    modifiers: ['pencil lines', 'graphite texture', 'paper grain', 'cross-hatching', 'construction lines', 'sketch marks', 'eraser smudges', 'draft aesthetic'],
  },

  amber: {
    name: 'amber',
    displayName: 'Amber',
    description: 'Warm golden tones with luxury feel',
    bestFor: 'Luxury brands, premium products, executive presentations',
    colors: {
      background: '#1a1510',
      primary: '#d4a574',
      secondary: '#b8860b',
      accent: '#ffd700',
      text: '#f5e6d3',
      muted: '#a08060',
    },
    fonts: {
      headline: "'Playfair Display', serif",
      body: "'Raleway', sans-serif",
      accent: "'Cormorant', serif",
    },
    promptTemplate: '{content}, warm amber golden tones, luxury aesthetic, honey colored lighting, bronze metallic accents, premium feel, elegant sophisticated design, rich warm atmosphere, golden hour light, high-end presentation, executive quality',
    negativePrompt: 'cold colors, blue tones, silver, chrome, casual, cheap, bright white, harsh lighting, industrial, minimalist stark',
    modifiers: ['golden lighting', 'amber tones', 'bronze accents', 'luxury texture', 'warm atmosphere', 'elegant composition', 'premium quality', 'sophisticated design'],
    effects: [{ type: 'vignette', intensity: 0.2 }],
  },

  ginkgo: {
    name: 'ginkgo',
    displayName: 'Ginkgo',
    description: 'Japanese minimalism with zen aesthetic',
    bestFor: 'Wellness, mindfulness, zen, Japanese culture',
    colors: {
      background: '#f7f5f0',
      primary: '#5c6b5e',
      secondary: '#a8b5a0',
      accent: '#c9a227',
      text: '#3d3d3d',
      muted: '#888888',
    },
    fonts: {
      headline: "'Noto Serif JP', serif",
      body: "'Noto Sans JP', sans-serif",
      accent: "'Shippori Mincho', serif",
    },
    promptTemplate: '{content}, Japanese minimalist aesthetic, zen garden inspiration, ginkgo leaf motifs, soft muted colors, peaceful composition, wabi-sabi philosophy, natural simplicity, meditative atmosphere, ink wash painting influence, negative space',
    negativePrompt: 'busy, cluttered, loud colors, western style, industrial, complex, ornate, baroque, maximalist, chaotic',
    modifiers: ['minimalist composition', 'zen aesthetic', 'ginkgo leaf motif', 'ink wash style', 'negative space', 'soft colors', 'natural elements', 'peaceful atmosphere'],
  },

  neon: {
    name: 'neon',
    displayName: 'Neon',
    description: 'Cyberpunk glow with synthwave vibes',
    bestFor: 'Gaming, tech, nightlife, futuristic',
    colors: {
      background: '#0a0a0f',
      primary: '#ff00ff',
      secondary: '#00ffff',
      accent: '#ff6b6b',
      text: '#ffffff',
      muted: '#666666',
    },
    fonts: {
      headline: "'Orbitron', sans-serif",
      body: "'Rajdhani', sans-serif",
      accent: "'Press Start 2P', cursive",
    },
    promptTemplate: '{content}, neon cyberpunk aesthetic, glowing neon lights, dark urban background, futuristic tech style, synthwave atmosphere, pink and cyan neon, electric glow effects, night city vibes, gaming aesthetic, digital future',
    negativePrompt: 'daylight, natural, organic, vintage, retro, warm colors, earth tones, classical, traditional, muted, soft',
    modifiers: ['neon glow', 'cyberpunk style', 'dark background', 'electric colors', 'synthwave aesthetic', 'urban night', 'futuristic tech', 'high contrast'],
    effects: [{ type: 'glow', intensity: 0.5 }],
  },

  paper: {
    name: 'paper',
    displayName: 'Paper',
    description: 'Craft paper with handmade DIY feel',
    bestFor: 'Crafts, DIY, personal projects, scrapbooking',
    colors: {
      background: '#e8dcc8',
      primary: '#5d4e37',
      secondary: '#8b7355',
      accent: '#c44536',
      text: '#3d3d3d',
      muted: '#888888',
    },
    fonts: {
      headline: "'Amatic SC', cursive",
      body: "'Kalam', cursive",
      accent: "'Special Elite', cursive",
    },
    promptTemplate: '{content}, kraft paper texture, handmade craft aesthetic, scrapbook style, paper cutout elements, warm tactile feel, DIY presentation, washi tape accents, hand-lettering style, vintage paper layers, collage composition',
    negativePrompt: 'digital, glossy, polished, corporate, sterile, cold, plastic, synthetic, modern minimalist, high tech',
    modifiers: ['kraft paper texture', 'paper cutouts', 'washi tape', 'hand-lettering', 'collage style', 'vintage paper', 'craft aesthetic', 'tactile feel'],
  },

  blueprint: {
    name: 'blueprint',
    displayName: 'Blueprint',
    description: 'Technical drawing with engineering aesthetic',
    bestFor: 'Engineering, architecture, technical presentations',
    colors: {
      background: '#1e3a5f',
      primary: '#ffffff',
      secondary: '#87ceeb',
      accent: '#ffd700',
      text: '#ffffff',
      muted: '#87ceeb',
    },
    fonts: {
      headline: "'Oswald', sans-serif",
      body: "'Roboto Mono', monospace",
      accent: "'Share Tech Mono', monospace",
    },
    promptTemplate: '{content}, technical blueprint style, architectural drawing, blue background with white lines, engineering schematic, grid pattern, measurement annotations, technical illustration, CAD drawing aesthetic, construction document style, precise lines',
    negativePrompt: 'colorful, painted, artistic, organic, natural, soft, hand-drawn messy, watercolor, impressionist, abstract',
    modifiers: ['blueprint grid', 'technical lines', 'measurement marks', 'schematic style', 'engineering aesthetic', 'white on blue', 'precise geometry', 'architectural drawing'],
  },

  polaroid: {
    name: 'polaroid',
    displayName: 'Polaroid',
    description: 'Instant photo with nostalgic feel',
    bestFor: 'Personal stories, memories, photo-heavy presentations',
    colors: {
      background: '#f5f5f5',
      primary: '#2c2c2c',
      secondary: '#666666',
      accent: '#e74c3c',
      text: '#333333',
      muted: '#888888',
    },
    fonts: {
      headline: "'Reenie Beanie', cursive",
      body: "'Shadows Into Light', cursive",
      accent: "'Permanent Marker', cursive",
    },
    promptTemplate: '{content}, polaroid instant photo style, white frame border, slightly faded colors, nostalgic photography, personal memories, vintage instant camera aesthetic, soft vignette, warm color cast, casual snapshot feel',
    negativePrompt: 'professional photography, studio lighting, HDR, oversaturated, digital perfect, corporate, formal, posed, artificial',
    modifiers: ['polaroid frame', 'faded colors', 'vintage photo', 'white border', 'soft vignette', 'nostalgic feel', 'instant camera', 'casual snapshot'],
    effects: [{ type: 'vignette', intensity: 0.15 }],
  },

  mosaic: {
    name: 'mosaic',
    displayName: 'Mosaic',
    description: 'Colorful tile patterns with cultural richness',
    bestFor: 'Cultural events, diversity, artistic presentations',
    colors: {
      background: '#f8f4ef',
      primary: '#1a5f7a',
      secondary: '#c44536',
      accent: '#f7b32b',
      text: '#2d2d2d',
      muted: '#666666',
    },
    fonts: {
      headline: "'Abril Fatface', cursive",
      body: "'Josefin Sans', sans-serif",
      accent: "'Pacifico', cursive",
    },
    promptTemplate: '{content}, mosaic tile pattern aesthetic, colorful geometric tiles, Mediterranean style, artistic cultural design, multi-colored pattern, handcrafted tile texture, Moroccan influence, vibrant diversity, intricate geometric patterns',
    negativePrompt: 'plain, solid color, minimalist, monochrome, simple, modern flat, corporate, sterile, uniform, boring',
    modifiers: ['tile pattern', 'geometric shapes', 'multi-colored', 'Mediterranean style', 'cultural design', 'handcrafted texture', 'intricate pattern', 'artisan quality'],
  },
};

// Default SwissBrAIn theme (uses sovereignTeal)
export const SWISSBRAIN_THEME_COLORS = {
  background: '#ffffff',
  primary: '#1D4E5F',      // sovereignTeal
  secondary: '#722F37',    // imperialBurgundy
  accent: '#1D4E5F',
  text: '#1F2937',
  muted: '#6B7280',
};

// Chart.js color palette for data slides
export const CHART_COLORS = {
  primary: 'rgba(29, 78, 95, 0.8)',       // sovereignTeal
  secondary: 'rgba(114, 47, 55, 0.8)',    // imperialBurgundy
  tertiary: 'rgba(15, 76, 129, 0.8)',     // midnightSapphire
  quaternary: 'rgba(212, 175, 55, 0.8)',  // gold
  quinary: 'rgba(45, 90, 39, 0.8)',       // grove green
  senary: 'rgba(102, 126, 234, 0.8)',     // chromatic
};

export function getStyleConfig(styleName: SlideStyleName): StyleConfig {
  return SLIDE_STYLES[styleName] || SLIDE_STYLES.chromatic;
}

export function inferStyleFromContent(content: string): SlideStyleName {
  const contentLower = content.toLowerCase();
  
  const styleMapping: Record<string, SlideStyleName> = {
    technology: 'chromatic',
    tech: 'chromatic',
    startup: 'chromatic',
    nature: 'grove',
    environment: 'grove',
    sustainability: 'grove',
    education: 'whiteboard',
    workshop: 'whiteboard',
    training: 'whiteboard',
    art: 'easel',
    creative: 'easel',
    design: 'easel',
    history: 'fresco',
    classical: 'fresco',
    museum: 'fresco',
    music: 'vinyl',
    entertainment: 'vinyl',
    retro: 'vinyl',
    business: 'amber',
    luxury: 'amber',
    executive: 'amber',
    wellness: 'ginkgo',
    zen: 'ginkgo',
    mindfulness: 'ginkgo',
    gaming: 'neon',
    cyberpunk: 'neon',
    futuristic: 'neon',
    engineering: 'blueprint',
    architecture: 'blueprint',
    technical: 'blueprint',
    personal: 'polaroid',
    memories: 'polaroid',
    photos: 'polaroid',
    culture: 'mosaic',
    diversity: 'mosaic',
    craft: 'paper',
    diy: 'paper',
    product: 'diorama',
    concept: 'sketch',
  };
  
  for (const [keyword, style] of Object.entries(styleMapping)) {
    if (contentLower.includes(keyword)) {
      return style;
    }
  }
  
  return 'chromatic'; // Default
}

export function getStyleDisplayInfo(styleName: SlideStyleName): { icon: string; color: string } {
  const iconMap: Record<SlideStyleName, { icon: string; color: string }> = {
    vinyl: { icon: 'Disc', color: '#d4af37' },
    whiteboard: { icon: 'PenTool', color: '#2c3e50' },
    grove: { icon: 'Leaf', color: '#2d5a27' },
    fresco: { icon: 'Palette', color: '#8b4513' },
    easel: { icon: 'Brush', color: '#c44536' },
    diorama: { icon: 'Box', color: '#7c9885' },
    chromatic: { icon: 'Sparkles', color: '#667eea' },
    sketch: { icon: 'Pencil', color: '#2c2c2c' },
    amber: { icon: 'Sun', color: '#d4a574' },
    ginkgo: { icon: 'TreeDeciduous', color: '#5c6b5e' },
    neon: { icon: 'Zap', color: '#ff00ff' },
    paper: { icon: 'FileText', color: '#5d4e37' },
    blueprint: { icon: 'Ruler', color: '#1e3a5f' },
    polaroid: { icon: 'Camera', color: '#e74c3c' },
    mosaic: { icon: 'Grid3x3', color: '#1a5f7a' },
  };
  
  return iconMap[styleName] || { icon: 'Presentation', color: '#1D4E5F' };
}
