import express from 'express';
import Book from '../models/Book.js';
import Review from '../models/Review.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const books = await Book.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Book.countDocuments();

    const booksWithRatings = await Promise.all(
      books.map(async (book) => {
        const reviews = await Review.find({ bookId: book._id });
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;
        return {
          ...book.toObject(),
          averageRating: Math.round(avgRating * 10) / 10,
          reviewCount: reviews.length
        };
      })
    );

    res.json({
      books: booksWithRatings,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const reviews = await Review.find({ bookId: book._id }).sort({ createdAt: -1 });
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      ...book.toObject(),
      averageRating: Math.round(avgRating * 10) / 10,
      reviews
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, author, genre, year, description, imageUrl } = req.body;

    if (!title || !author || !genre || !year || !description) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const book = new Book({
      title,
      author,
      genre,
      year,
      description,
      imageUrl: imageUrl || undefined,
      userId: req.user.userId,
      username: req.user.username
    });

    await book.save();
    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to edit this book' });
    }

    const { title, author, genre, year, description, imageUrl } = req.body;

    book.title = title || book.title;
    book.author = author || book.author;
    book.genre = genre || book.genre;
    book.year = year || book.year;
    book.description = description || book.description;
    book.imageUrl = imageUrl || book.imageUrl;

    await book.save();
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.userId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this book' });
    }

    await Review.deleteMany({ bookId: book._id });
    await Book.findByIdAndDelete(req.params.id);

    res.json({ message: 'Book and associated reviews deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
