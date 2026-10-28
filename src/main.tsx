import { createRoot } from 'react-dom/client';
import '@fontsource/ma-shan-zheng/400.css';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/700.css';
import './styles.css';
import { App } from './ui/App';

createRoot(document.getElementById('root')!).render(<App />);
