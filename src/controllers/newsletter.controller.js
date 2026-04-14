import Newsletter from "../models/newsletter.model.js";

/* =========================
   SUBSCRIBE NEWSLETTER
   POST /api/newsletter
========================= */
export const subscribeNewsletter = async (req, res) => {
  try {
    const { email, source } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    let subscriber = await Newsletter.findOne({ email });

    if (subscriber && subscriber.isSubscribed) {
      return res.status(201).json({
        success: false,
        message: "Email already subscribed"
      });
    }

    if (subscriber && !subscriber.isSubscribed) {
      subscriber.isSubscribed = true;
      subscriber.unsubscribedAt = null;
      await subscriber.save();

      return res.status(200).json({
        success: true,
        message: "Subscribed again successfully"
      });
    }

    subscriber = await Newsletter.create({
      email,
      source
    });

    return res.status(201).json({
      success: true,
      message: "Subscribed successfully",
      subscriber
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to subscribe"
    });
  }
};

/* =========================
   GET ALL SUBSCRIBERS (ADMIN)
   GET /api/newsletter
========================= */
export const getSubscribers = async (req, res) => {
  try {
    const subscribers = await Newsletter.find().sort({
      createdAt: -1
    });

    return res.status(200).json({
      success: true,
      subscribers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscribers"
    });
  }
};

/* =========================
   GET SUBSCRIBER BY ID
   GET /api/newsletter/:id
========================= */
export const getSubscriberById = async (req, res) => {
  try {
    const subscriber = await Newsletter.findById(req.params.id);

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Subscriber not found"
      });
    }

    return res.status(200).json({
      success: true,
      subscriber
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscriber"
    });
  }
};

/* =========================
   UPDATE SUBSCRIBER (ADMIN)
   PUT /api/newsletter/:id
========================= */
export const updateSubscriber = async (req, res) => {
  try {
    const updates = { ...req.body };

    const subscriber = await Newsletter.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Subscriber not found"
      });
    }

    return res.status(200).json({
      success: true,
      subscriber
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update subscriber"
    });
  }
};

/* =========================
   UNSUBSCRIBE NEWSLETTER
   PUT /api/newsletter/unsubscribe
========================= */
export const unsubscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;

    const subscriber = await Newsletter.findOneAndUpdate(
      { email },
      {
        isSubscribed: false,
        unsubscribedAt: new Date()
      },
      { new: true }
    );

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Email not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Unsubscribed successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to unsubscribe"
    });
  }
};

/* =========================
   DELETE SUBSCRIBER (ADMIN)
   DELETE /api/newsletter/:id
========================= */
export const deleteSubscriber = async (req, res) => {
  try {
    const subscriber = await Newsletter.findByIdAndDelete(req.params.id);

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Subscriber not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subscriber deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete subscriber"
    });
  }
};