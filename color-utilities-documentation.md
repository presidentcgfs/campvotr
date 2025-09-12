# Color Utilities Documentation

## Overview

A comprehensive set of color generation utilities that create consistent, deterministic colors from strings. Perfect for generating avatar backgrounds, user identifiers, category tags, and other UI elements that need consistent coloring.

## Key Features

- **Deterministic**: Same input always produces the same color
- **Multiple Variants**: Standard, pastel, vibrant, and gradient options
- **Contrast Aware**: Automatically determines optimal text color
- **Avatar Support**: Generates initials and colors for user avatars
- **Tailwind Compatible**: Can generate Tailwind CSS classes
- **Palette Based**: Option to use predefined color palettes

## Functions

### Core Color Generation

#### `stringToColor(str: string): string`
Generates a standard color from a string.
```typescript
stringToColor('John Doe') // Returns: '#4A90E2'
```

#### `stringToPastelColor(str: string): string`
Generates soft, pastel colors perfect for backgrounds.
```typescript
stringToPastelColor('Alice') // Returns: '#E8D5F2'
```

#### `stringToVibrantColor(str: string): string`
Generates bright, saturated colors for emphasis.
```typescript
stringToVibrantColor('Bob') // Returns: '#FF5722'
```

#### `stringToPaletteColor(str: string, palette?: string[]): string`
Selects a color from a predefined palette.
```typescript
stringToPaletteColor('Category1') // Returns color from default palette
```

### Utility Functions

#### `getContrastTextColor(bgColor: string): string`
Determines whether black or white text provides better contrast.
```typescript
getContrastTextColor('#4A90E2') // Returns: '#FFFFFF'
getContrastTextColor('#F0F0F0') // Returns: '#000000'
```

#### `getInitials(name: string): string`
Extracts initials from a name or email.
```typescript
getInitials('John Doe') // Returns: 'JD'
getInitials('alice@example.com') // Returns: 'AL'
getInitials('bob.smith') // Returns: 'BS'
```

#### `stringToGradient(str: string, direction?: string): string`
Generates a CSS gradient from a string.
```typescript
stringToGradient('User123') 
// Returns: 'linear-gradient(to right, #4A90E2, #7B68EE)'
```

### Tailwind Integration

#### `stringToTailwindBg(str: string, intensity?: number): string`
Generates Tailwind background classes.
```typescript
stringToTailwindBg('Alice', 500) // Returns: 'bg-blue-500'
```

#### `stringToTailwindText(str: string, intensity?: number): string`
Generates Tailwind text color classes.
```typescript
stringToTailwindText('Bob', 700) // Returns: 'text-red-700'
```

## Components

### ColorAvatar Component

A reusable avatar component that uses the color utilities.

```svelte
<ColorAvatar 
  name="John Doe"
  email="john@example.com"
  size="lg"
  variant="vibrant"
  rounded="full"
/>
```

**Props:**
- `name`: Display name
- `email`: Email address (fallback for name)
- `src`: Optional image URL
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
- `variant`: 'vibrant' | 'pastel' | 'gradient'
- `rounded`: 'full' | 'lg' | 'md' | 'sm' | 'none'
- `border`: Show border ring

## Use Cases

### 1. User Avatars
```typescript
const bgColor = stringToVibrantColor(user.email);
const initials = getInitials(user.name);
const textColor = getContrastTextColor(bgColor);
```

### 2. Category Tags
```typescript
categories.map(cat => ({
  name: cat,
  bgColor: stringToPastelColor(cat),
  textColor: stringToVibrantColor(cat)
}))
```

### 3. Status Indicators
```typescript
const statusColor = stringToPaletteColor(status);
const borderColor = stringToVibrantColor(status);
```

### 4. Team Member Cards
```svelte
{#each teamMembers as member}
  <ColorAvatar 
    name={member.name}
    variant="vibrant"
  />
{/each}
```

### 5. Consistent User Identification
Users always get the same color across the application:
```typescript
// In header
const userColor = stringToColor(userId);

// In comments
const authorColor = stringToColor(userId); // Same color!
```

## Algorithm Details

The color generation uses a hash function to ensure:
1. **Consistency**: Same input → same output
2. **Distribution**: Good spread across color spectrum
3. **Aesthetics**: Controlled saturation and lightness ranges

### Hash Function
```typescript
let hash = 0;
for (let i = 0; i < str.length; i++) {
  hash = str.charCodeAt(i) + ((hash << 5) - hash);
  hash = hash & hash; // 32-bit integer
}
```

### HSL Ranges
- **Standard**: S: 65-85%, L: 45-60%
- **Pastel**: S: 25-55%, L: 75-90%
- **Vibrant**: S: 70-100%, L: 45-55%

## Integration Examples

### In Draw Sessions
```typescript
// Generate consistent colors for participants
const participantColor = stringToVibrantColor(participant.email);
const avatarUrl = `https://ui-avatars.com/api/?name=${name}&background=${bgColor}`;
```

### In Time Slots
```typescript
// Color code by field
const fieldColor = stringToPastelColor(slot.fieldName);
```

### In User Lists
```svelte
<div class="flex items-center space-x-3">
  <ColorAvatar name={user.name} size="md" />
  <span>{user.name}</span>
</div>
```

## Benefits

1. **No Database Storage**: Colors generated on-the-fly
2. **Consistent UX**: Same entity always has same color
3. **Performance**: Fast hash-based generation
4. **Accessibility**: Automatic contrast calculation
5. **Flexibility**: Multiple color schemes available
6. **Zero Dependencies**: Pure TypeScript implementation

## Demo

Visit `/demo/colors` to see interactive examples of all color utilities in action.
