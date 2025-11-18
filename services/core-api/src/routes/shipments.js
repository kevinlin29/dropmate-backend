import express from "express";
import {
  listShipments,
  getShipmentById,
  getShipmentByTrackingNumber,
  getShipmentWithLiveLocation,
  assignDriverToShipment,
  updateShipmentStatus,
  updatePackageStatus,
} from "../models/shipmentsModel.js";

const router = express.Router();

// GET /api/shipments - list all shipments
router.get("/", async (_req, res) => {
  try {
    const shipments = await listShipments();
    res.json(shipments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shipments" });
  }
});

// GET /api/shipments/:id - get shipment by ID
router.get("/:id", async (req, res) => {
  try {
    const shipment = await getShipmentById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ error: "Shipment not found" });
    }
    res.json(shipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shipment" });
  }
});

// GET /api/shipments/track/:trackingNumber - track by tracking number
router.get("/track/:trackingNumber", async (req, res) => {
  try {
    const shipment = await getShipmentByTrackingNumber(req.params.trackingNumber);
    if (!shipment) {
      return res.status(404).json({ error: "Shipment not found" });
    }
    res.json(shipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to track shipment" });
  }
});

// GET /api/shipments/:id/location - get shipment with live driver location
router.get("/:id/location", async (req, res) => {
  try {
    const shipment = await getShipmentWithLiveLocation(req.params.id);
    if (!shipment) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    // If no driver assigned or no location data
    if (!shipment.driver_id) {
      return res.json({
        ...shipment,
        current_location: null,
        message: "No driver assigned yet",
      });
    }

    res.json(shipment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shipment location" });
  }
});

// POST /api/shipments/:id/assign-driver - assign driver to shipment
router.post("/:id/assign-driver", async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ error: "Driver ID is required" });
    }

    const updated = await assignDriverToShipment(req.params.id, driverId);
    const io = req.app.get("io");
    io.emit("shipment_assigned", {
      shipmentId: updated.id,
      driverId: updated.driver_id,
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign driver" });
  }
});

// PATCH /api/shipments/:id/status - update shipment status
router.patch("/:id/status", async (req, res) => {
  try {
    const updated = await updateShipmentStatus(req.params.id, req.body.status);
    const io = req.app.get("io");

    // Emit WebSocket event with correct format for mobile app
    const wsPayload = {
      shipmentId: updated.id,
      status: updated.status,
      shipment: updated,
      timestamp: new Date().toISOString()
    };

    console.log('📦 [SYNC] ===== SHIPMENT STATUS UPDATE EMITTED =====');
    console.log('📦 [SYNC] Shipment ID:', updated.id);
    console.log('📦 [SYNC] New Status:', updated.status);
    console.log('📦 [SYNC] Broadcasting to notification-room');

    io.to('notification-room').emit('shipment_status_updated', wsPayload);
    // Also broadcast globally for backward compatibility
    io.emit("shipment_updated", { id: updated.id, status: updated.status });

    // Send push notification asynchronously (don't block response)
    if (updated.customer_id) {
      import("../services/pushNotificationService.js")
        .then(({ default: pushService }) => {
          return pushService.sendShipmentStatusNotification(
            updated.customer_id,
            updated,
            updated.status
          );
        })
        .catch(err => {
          console.error('Failed to send push notification:', err);
        });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update shipment status" });
  }
});

// PATCH /api/shipments/:id/package-status - update package delivery status
router.patch("/:id/package-status", async (req, res) => {
  try {
    const { packageStatus } = req.body;

    if (!packageStatus) {
      return res.status(400).json({ error: "Package status is required" });
    }

    const updated = await updatePackageStatus(req.params.id, packageStatus, req.user?.id);
    const io = req.app.get("io");

    // Emit WebSocket event with correct format
    const wsPayload = {
      shipmentId: updated.id,
      packageStatus: updated.package_status,
      shipment: updated,
      trackingNumber: updated.tracking_number,
      timestamp: new Date().toISOString()
    };

    console.log('📦 [SYNC] ===== PACKAGE STATUS UPDATE EMITTED =====');
    console.log('📦 [SYNC] Shipment ID:', updated.id);
    console.log('📦 [SYNC] Package Status:', updated.package_status);
    console.log('📦 [SYNC] Broadcasting to notification-room');

    io.to('notification-room').emit('package_status_updated', wsPayload);
    // Also broadcast globally for backward compatibility
    io.emit("package_status_updated", {
      id: updated.id,
      packageStatus: updated.package_status,
      trackingNumber: updated.tracking_number
    });

    // Send push notification asynchronously (don't block response)
    if (updated.customer_id) {
      import("../services/pushNotificationService.js")
        .then(({ default: pushService }) => {
          return pushService.sendPackageStatusNotification(
            updated.customer_id,
            updated,
            updated.package_status
          );
        })
        .catch(err => {
          console.error('Failed to send push notification:', err);
        });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    if (err.message.includes('Invalid package status')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to update package status" });
  }
});

// GET /api/shipments/:id/events - get shipment status history (admin view)
router.get("/:id/events", async (req, res) => {
  try {
    const { getShipmentEvents } = await import("../models/shipmentEventsModel.js");
    const includeLocationUpdates = req.query.includeLocationUpdates === 'true';
    const limit = parseInt(req.query.limit) || 100;

    const events = await getShipmentEvents(req.params.id, {
      limit,
      includeLocationUpdates
    });

    res.json({
      shipmentId: parseInt(req.params.id),
      count: events.length,
      events
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch shipment events" });
  }
});

export default router;
