import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth.middleware';
import {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, uploadImages, getTokens, getMyProducts, getHomepageProducts,
} from './products.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!') as any, false);
    }
  }
});

router.get('/', getProducts);
router.get('/homepage', getHomepageProducts);
router.get('/tokens', getTokens);
router.get('/my', authenticate, getMyProducts);
router.get('/:id', getProduct);
router.post('/', authenticate, createProduct);
router.put('/:id', authenticate, updateProduct);
router.delete('/:id', authenticate, deleteProduct);
router.post('/upload-images', authenticate, upload.array('images', 10), uploadImages);

export default router;
