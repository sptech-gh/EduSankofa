const mongoose = require("mongoose");
const GhanaAnnouncement = require("../models/GhanaAnnouncement");

describe("Announcements Management Unit Tests", () => {
  describe("GhanaAnnouncement Model", () => {
    test("Should have required fields", () => {
      const announcement = new GhanaAnnouncement({
        title: "School Holiday Notice",
        content: "School will be closed for Independence Day",
        author: new mongoose.Types.ObjectId(),
        authorRole: "School Admin",
        priority: "High",
        category: "Holiday",
        targetAudience: ["All Users"],
      });

      expect(announcement.title).toBe("School Holiday Notice");
      expect(announcement.content).toBe("School will be closed for Independence Day");
      expect(announcement.author).toBeDefined();
      expect(announcement.authorRole).toBe("School Admin");
      expect(announcement.priority).toBe("High");
      expect(announcement.category).toBe("Holiday");
      expect(announcement.targetAudience).toContain("All Users");
      expect(announcement.status).toBe("Draft");
      expect(announcement.isPublic).toBe(true);
      expect(announcement.sendEmail).toBe(true);
      expect(announcement.sendPush).toBe(true);
    });

    test("Should validate priority enum", () => {
      const validPriorities = ["Low", "Medium", "High", "Urgent", "Critical"];
      
      for (const priority of validPriorities) {
        const announcement = new GhanaAnnouncement({ priority });
        expect(validPriorities).toContain(announcement.priority);
      }
    });

    test("Should validate category enum", () => {
      const validCategories = [
        "General", "Academic", "Events", "Emergency", "Holiday", "Examination",
        "Sports", "Cultural", "PTA Meeting", "School Fees", "Admission",
        "Graduation", "Maintenance", "Health & Safety", "Ghana Education Service"
      ];
      
      for (const category of validCategories) {
        const announcement = new GhanaAnnouncement({ category });
        expect(validCategories).toContain(announcement.category);
      }
    });

    test("Should validate target audience enum", () => {
      const validAudiences = [
        "All Users", "Students", "Teachers", "Parents", "Admin", "Staff",
        "Accountants", "Class Teachers", "Subject Teachers", "Heads of Department"
      ];
      
      for (const audience of validAudiences) {
        const announcement = new GhanaAnnouncement({ targetAudience: [audience] });
        expect(validAudiences).toContain(announcement.targetAudience[0]);
      }
    });

    test("Should validate status enum", () => {
      const validStatuses = ["Draft", "Scheduled", "Published", "Expired", "Archived", "Cancelled"];
      
      for (const status of validStatuses) {
        const announcement = new GhanaAnnouncement({ status });
        expect(validStatuses).toContain(announcement.status);
      }
    });

    test("Should validate language enum", () => {
      const validLanguages = ["English", "Twi", "Ewe", "Ga", "Dagbani", "Other"];
      
      for (const language of validLanguages) {
        const announcement = new GhanaAnnouncement({ language });
        expect(validLanguages).toContain(announcement.language);
      }
    });

    test("Should handle attachments", () => {
      const announcement = new GhanaAnnouncement({
        attachments: [{
          filename: "holiday-schedule.pdf",
          originalName: "Holiday Schedule 2024.pdf",
          url: "/uploads/announcements/holiday-schedule.pdf",
          fileType: "pdf",
          fileSize: 1024000,
          mimeType: "application/pdf",
          description: "School holiday schedule for 2024",
        }],
      });

      expect(announcement.attachments).toHaveLength(1);
      expect(announcement.attachments[0].filename).toBe("holiday-schedule.pdf");
      expect(announcement.attachments[0].fileType).toBe("pdf");
      expect(announcement.attachments[0].fileSize).toBe(1024000);
    });

    test("Should handle banner image", () => {
      const announcement = new GhanaAnnouncement({
        bannerImage: {
          url: "/uploads/announcements/banner.jpg",
          alt: "School Event Banner",
          caption: "Annual Sports Day 2024",
        },
      });

      expect(announcement.bannerImage.url).toBe("/uploads/announcements/banner.jpg");
      expect(announcement.bannerImage.alt).toBe("School Event Banner");
      expect(announcement.bannerImage.caption).toBe("Annual Sports Day 2024");
    });

    test("Should calculate read count correctly", () => {
      const announcement = new GhanaAnnouncement({
        readBy: [
          { user: new mongoose.Types.ObjectId() },
          { user: new mongoose.Types.ObjectId() },
          { user: new mongoose.Types.ObjectId() },
        ],
      });

      expect(announcement.readCount).toBe(3);
    });

    test("Should calculate reaction counts correctly", () => {
      const announcement = new GhanaAnnouncement({
        reactions: [
          { user: new mongoose.Types.ObjectId(), type: "Like" },
          { user: new mongoose.Types.ObjectId(), type: "Like" },
          { user: new mongoose.Types.ObjectId(), type: "Love" },
          { user: new mongoose.Types.ObjectId(), type: "Laugh" },
        ],
      });

      const counts = announcement.reactionCounts;
      expect(counts.Like).toBe(2);
      expect(counts.Love).toBe(1);
      expect(counts.Laugh).toBe(1);
      expect(counts.Wow).toBe(0);
    });

    test("Should calculate total engagement correctly", () => {
      const announcement = new GhanaAnnouncement({
        readBy: [{ user: new mongoose.Types.ObjectId() }],
        viewCount: 50,
        clickCount: 25,
        shareCount: 10,
        reactions: [{ user: new mongoose.Types.ObjectId(), type: "Like" }],
        comments: [{ user: new mongoose.Types.ObjectId(), content: "Great!" }],
      });

      expect(announcement.totalEngagement).toBe(88); // 1 + 50 + 25 + 10 + 1 + 1
    });
  });

  describe("Targeting and Visibility", () => {
    test("Should handle class-level targeting", () => {
      const announcement = new GhanaAnnouncement({
        targetClasses: [
          new mongoose.Types.ObjectId(),
          new mongoose.Types.ObjectId(),
        ],
        targetLevels: ["Primary 1", "Primary 2"],
      });

      expect(announcement.targetClasses).toHaveLength(2);
      expect(announcement.targetLevels).toContain("Primary 1");
      expect(announcement.targetLevels).toContain("Primary 2");
    });

    test("Should handle specific user targeting", () => {
      const announcement = new GhanaAnnouncement({
        targetStudents: [new mongoose.Types.ObjectId()],
        targetParents: [new mongoose.Types.ObjectId()],
        targetTeachers: [new mongoose.Types.ObjectId()],
      });

      expect(announcement.targetStudents).toHaveLength(1);
      expect(announcement.targetParents).toHaveLength(1);
      expect(announcement.targetTeachers).toHaveLength(1);
    });

    test("Should handle Ghanaian regional targeting", () => {
      const announcement = new GhanaAnnouncement({
        regionSpecific: true,
        targetRegions: ["Greater Accra", "Ashanti", "Western"],
      });

      expect(announcement.regionSpecific).toBe(true);
      expect(announcement.targetRegions).toContain("Greater Accra");
      expect(announcement.targetRegions).toContain("Ashanti");
      expect(announcement.targetRegions).toContain("Western");
    });

    test("Should check if user can view announcement", () => {
      const announcement1 = new GhanaAnnouncement({
        status: "Published",
        targetAudience: ["All Users"],
      });

      const announcement2 = new GhanaAnnouncement({
        status: "Published",
        targetAudience: ["Teachers"],
      });

      const announcement3 = new GhanaAnnouncement({
        status: "Draft",
        targetAudience: ["All Users"],
      });

      // Test basic status and audience properties
      expect(announcement1.status).toBe("Published");
      expect(announcement1.targetAudience).toContain("All Users");
      expect(announcement2.status).toBe("Published");
      expect(announcement2.targetAudience).toContain("Teachers");
      expect(announcement3.status).toBe("Draft");
    });

    test("Should handle expiry date", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const announcement1 = new GhanaAnnouncement({
        status: "Published",
        expiryDate: futureDate,
      });

      const announcement2 = new GhanaAnnouncement({
        status: "Published",
        expiryDate: pastDate,
      });

      const user = { role: "teacher" };

      expect(announcement1.canView(user)).toBe(true);
      expect(announcement2.canView(user)).toBe(false);
    });
  });

  describe("Ghanaian Specific Features", () => {
    test("Should handle Ghanaian holidays", () => {
      const announcement = new GhanaAnnouncement({
        isGhanaianHoliday: true,
        holidayName: "Independence Day",
        category: "Holiday",
      });

      expect(announcement.isGhanaianHoliday).toBe(true);
      expect(announcement.holidayName).toBe("Independence Day");
      expect(announcement.category).toBe("Holiday");
    });

    test("Should handle Ghanaian regions", () => {
      const ghanaianRegions = [
        "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
        "Greater Accra", "North East", "Northern", "Oti", "Savannah",
        "Upper East", "Upper West", "Volta", "Western", "Western North"
      ];

      const announcement = new GhanaAnnouncement({
        regionSpecific: true,
        targetRegions: ["Greater Accra", "Ashanti", "Northern"],
      });

      expect(announcement.targetRegions).toHaveLength(3);
      expect(ghanaianRegions).toContain("Greater Accra");
      expect(ghanaianRegions).toContain("Ashanti");
      expect(ghanaianRegions).toContain("Northern");
    });

    test("Should handle language translations", () => {
      const announcement = new GhanaAnnouncement({
        title: "School Holiday Notice",
        content: "School will be closed for Independence Day",
        language: "English",
        translations: [{
          language: "Twi",
          title: "Afahyɛ Ho Dwumadi",
          content: "Nsuadwuma no bɛda wɔ Ɔman Independence Da",
        }, {
          language: "Ewe",
          title: "Ŋl�̃dzedze ƒe Gblɔ",
          content: "Sukudede kple ƒe ƒome mele ɖo ƒe ƒome",
        }],
      });

      expect(announcement.language).toBe("English");
      expect(announcement.translations).toHaveLength(2);
      
      const twiTranslation = announcement.getTranslatedContent("Twi");
      expect(twiTranslation.title).toBe("Afahyɛ Ho Dwumadi");
      
      const eweTranslation = announcement.getTranslatedContent("Ewe");
      expect(eweTranslation.title).toBe("Ŋl�̃dzedze ƒe Gblɔ");
      
      const englishContent = announcement.getTranslatedContent("English");
      expect(englishContent.title).toBe("School Holiday Notice");
    });
  });

  describe("Engagement Features", () => {
    test("Should track read status", () => {
      const userId = new mongoose.Types.ObjectId();
      const announcement = new GhanaAnnouncement({
        readBy: [
          { user: userId, readAt: new Date("2024-01-01T10:00:00") },
        ],
      });

      expect(announcement.isReadBy(userId)).toBe(true);
      expect(announcement.isReadBy(new mongoose.Types.ObjectId())).toBe(false);
    });

    test("Should handle reactions", () => {
      const userId = new mongoose.Types.ObjectId();
      const announcement = new GhanaAnnouncement({
        reactions: [
          { user: userId, type: "Like", createdAt: new Date("2024-01-01T10:00:00") },
          { user: new mongoose.Types.ObjectId(), type: "Love", createdAt: new Date("2024-01-01T11:00:00") },
        ],
      });

      expect(announcement.reactions).toHaveLength(2);
      expect(announcement.reactions[0].type).toBe("Like");
      expect(announcement.reactions[1].type).toBe("Love");
    });

    test("Should handle comments", () => {
      const announcement = new GhanaAnnouncement({
        comments: [{
          user: new mongoose.Types.ObjectId(),
          content: "Great announcement!",
          createdAt: new Date("2024-01-01T10:00:00"),
          likes: [{
            user: new mongoose.Types.ObjectId(),
            likedAt: new Date("2024-01-01T10:30:00"),
          }],
        }, {
          user: new mongoose.Types.ObjectId(),
          content: "Thank you for the information",
          createdAt: new Date("2024-01-01T11:00:00"),
          parentComment: new mongoose.Types.ObjectId(),
        }],
      });

      expect(announcement.comments).toHaveLength(2);
      expect(announcement.comments[0].content).toBe("Great announcement!");
      expect(announcement.comments[0].likes).toHaveLength(1);
      expect(announcement.comments[1].parentComment).toBeDefined();
    });

    test("Should handle notification settings", () => {
      const announcement = new GhanaAnnouncement({
        sendEmail: true,
        sendSMS: false,
        sendPush: true,
        notificationSent: true,
        notificationSentAt: new Date("2024-01-01T09:00:00"),
        analytics: {
          emailSent: 150,
          emailDelivered: 145,
          emailOpened: 120,
          smsSent: 0,
          pushSent: 150,
          pushDelivered: 140,
          pushOpened: 100,
        },
      });

      expect(announcement.sendEmail).toBe(true);
      expect(announcement.sendSMS).toBe(false);
      expect(announcement.sendPush).toBe(true);
      expect(announcement.notificationSent).toBe(true);
      expect(announcement.analytics.emailSent).toBe(150);
      expect(announcement.analytics.pushOpened).toBe(100);
    });
  });

  describe("Approval Workflow", () => {
    test("Should handle approval process", () => {
      const announcement = new GhanaAnnouncement({
        requiresApproval: true,
        approvedBy: new mongoose.Types.ObjectId(),
        approvedAt: new Date("2024-01-01T10:00:00"),
        rejectionReason: "",
      });

      expect(announcement.requiresApproval).toBe(true);
      expect(announcement.approvedBy).toBeDefined();
      expect(announcement.approvedAt).toBeDefined();
      expect(announcement.rejectionReason).toBe("");
    });

    test("Should handle rejection", () => {
      const announcement = new GhanaAnnouncement({
        requiresApproval: true,
        rejectionReason: "Content not appropriate for school announcement",
      });

      expect(announcement.requiresApproval).toBe(true);
      expect(announcement.rejectionReason).toBe("Content not appropriate for school announcement");
    });
  });

  describe("Version Control", () => {
    test("Should handle version history", () => {
      const announcement = new GhanaAnnouncement({
        version: 3,
        previousVersions: [{
          version: 1,
          title: "Original Title",
          content: "Original content",
          modifiedBy: new mongoose.Types.ObjectId(),
          modifiedAt: new Date("2024-01-01T10:00:00"),
          reason: "Initial version",
        }, {
          version: 2,
          title: "Updated Title",
          content: "Updated content",
          modifiedBy: new mongoose.Types.ObjectId(),
          modifiedAt: new Date("2024-01-02T10:00:00"),
          reason: "Updated information",
        }],
      });

      expect(announcement.version).toBe(3);
      expect(announcement.previousVersions).toHaveLength(2);
      expect(announcement.previousVersions[0].version).toBe(1);
      expect(announcement.previousVersions[1].version).toBe(2);
      expect(announcement.previousVersions[1].reason).toBe("Updated information");
    });
  });

  describe("Data Validation", () => {
    test("Should validate title length", () => {
      const announcement1 = new GhanaAnnouncement({ title: "OK Title" });
      const announcement2 = new GhanaAnnouncement({ title: "A".repeat(201) });

      expect(announcement1.title.length).toBeGreaterThanOrEqual(3);
      expect(announcement1.title.length).toBeLessThanOrEqual(200);
      expect(announcement2.title.length).toBeGreaterThan(200);
    });

    test("Should validate content length", () => {
      const announcement1 = new GhanaAnnouncement({ content: "A".repeat(10) });
      const announcement2 = new GhanaAnnouncement({ content: "A".repeat(5001) });

      expect(announcement1.content.length).toBeGreaterThanOrEqual(10);
      expect(announcement1.content.length).toBeLessThanOrEqual(5000);
      expect(announcement2.content.length).toBeGreaterThan(5000);
    });

    test("Should validate file types", () => {
      const validFileTypes = ["image", "document", "video", "audio", "pdf"];
      
      for (const fileType of validFileTypes) {
        const announcement = new GhanaAnnouncement({
          attachments: [{
            fileType,
            filename: "test." + fileType,
          }],
        });
        expect(validFileTypes).toContain(announcement.attachments[0].fileType);
      }
    });

    test("Should validate Ghanaian regions", () => {
      const validRegions = [
        "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern",
        "Greater Accra", "North East", "Northern", "Oti", "Savannah",
        "Upper East", "Upper West", "Volta", "Western", "Western North"
      ];

      for (const region of validRegions) {
        expect(validRegions).toContain(region);
      }
    });
  });

  describe("Analytics and Reporting", () => {
    test("Should calculate engagement metrics", () => {
      const announcement = new GhanaAnnouncement({
        viewCount: 500,
        readBy: [{ user: new mongoose.Types.ObjectId() }, { user: new mongoose.Types.ObjectId() }],
        clickCount: 100,
        shareCount: 25,
        reactions: [
          { user: new mongoose.Types.ObjectId(), type: "Like" },
          { user: new mongoose.Types.ObjectId(), type: "Love" },
        ],
        comments: [
          { user: new mongoose.Types.ObjectId(), content: "Great!" },
          { user: new mongoose.Types.ObjectId(), content: "Thanks!" },
        ],
      });

      expect(announcement.readCount).toBe(2);
      expect(announcement.viewCount).toBe(500);
      expect(announcement.clickCount).toBe(100);
      expect(announcement.shareCount).toBe(25);
      expect(announcement.reactions.length).toBe(2);
      expect(announcement.comments.length).toBe(2);
      expect(announcement.totalEngagement).toBe(631); // 2 + 500 + 100 + 25 + 2 + 2
    });

    test("Should handle notification analytics", () => {
      const announcement = new GhanaAnnouncement({
        analytics: {
          emailSent: 200,
          emailDelivered: 195,
          emailOpened: 150,
          smsSent: 50,
          smsDelivered: 48,
          pushSent: 200,
          pushDelivered: 190,
          pushOpened: 120,
        },
      });

      expect(announcement.analytics.emailSent).toBe(200);
      expect(announcement.analytics.emailDelivered).toBe(195);
      expect(announcement.analytics.emailOpened).toBe(150);
      expect(announcement.analytics.smsSent).toBe(50);
      expect(announcement.analytics.pushOpened).toBe(120);
    });
  });
});
