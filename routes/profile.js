import express from 'express';
import Book from '../models/Book.js';
import Review from '../models/Review.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const myBooks = await Book.find({ userId: req.user.userId }).sort({ createdAt: -1 });

    const myBooksWithRatings = await Promise.all(
      myBooks.map(async (book) => {
        const reviews = await Review.find({ bookId: book._id });
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;
        return {
          ...book.toObject(),
          averageRating: Math.round(avgRating * 10) / 10,
          reviewCount: reviews.length,
          reviews
        };
      })
    );

    const reviewsGiven = await Review.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .populate('bookId', 'title author');

    const allReviewsReceived = await Review.find({
      bookId: { $in: myBooks.map(b => b._id) }
    }).populate('bookId', 'title');

    const ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0
    };

    allReviewsReceived.forEach(review => {
      ratingDistribution[review.rating]++;
    });

    const givenRatingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0
    };

    reviewsGiven.forEach(review => {
      givenRatingDistribution[review.rating]++;
    });

    res.json({
      myBooks: myBooksWithRatings,
      reviewsGiven,
      reviewsReceived: allReviewsReceived,
      stats: {
        totalBooks: myBooks.length,
        totalReviewsGiven: reviewsGiven.length,
        totalReviewsReceived: allReviewsReceived.length,
        ratingDistribution,
        givenRatingDistribution
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
