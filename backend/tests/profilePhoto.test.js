// Profile photo routes (/api/settings): the replies carry only the message and the
// photo path, never the account record (password hash, reset token, page access).
// Removing a photo picks the default icon from the Employee record's gender (found by
// userId first, then by email); Super Admin and Admin accounts get the plain icon.
const request = require("supertest");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const { pagesForRole } = require("../config/pages");

const ADMIN_PAGE_KEYS = pagesForRole("Admin").map((page) => page.key);
const UPLOAD_DIR = path.join(__dirname, "../uploads");

const MALE = "/assets/genderIcons/male.svg";
const FEMALE = "/assets/genderIcons/female.svg";
const PLAIN = "/assets/user-circle.svg";
const SECRET_FIELDS = [
  "password",
  "resetToken",
  "pageAccess",
  "payAccess",
  "mustChangePassword",
  "email",
  "username",
  "role",
  "_id",
  "user",
  "error",
];

let mongo;
let tempFiles = [];

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  jest.restoreAllMocks();
  for (const file of tempFiles) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  tempFiles = [];
  await Promise.all([User.deleteMany({}), Employee.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const PASSWORD = "Password123!";

const loginAs = async (username) => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password: PASSWORD });
  return res.body.token;
};

const as = (token) => ({ Authorization: `Bearer ${token}` });

// An account, signed in. `employee` adds an Employee record linked by userId.
const account = async (
  username,
  { role = "Employee", pageAccess, profilePhoto, employee } = {},
) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status: "Active",
    resetToken: "reset-token-secret",
    ...(pageAccess ? { pageAccess } : {}),
    ...(profilePhoto !== undefined ? { profilePhoto } : {}),
  });
  if (employee) {
    await Employee.create({
      userId: user._id,
      firstName: username,
      lastName: "Test",
      email: `${username}@example.com`,
      role,
      ...employee,
    });
  }
  return { user, token: await loginAs(username) };
};

// A real file under backend/uploads, removed after the test if still there
const uploadedPhoto = () => {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `profile-photo-jest-${Date.now()}-${tempFiles.length}.png`;
  const filePath = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(filePath, Buffer.from("89504e470d0a1a0a", "hex"));
  tempFiles.push(filePath);
  return { urlPath: `/uploads/${name}`, filePath };
};

const removePhoto = (id, token) =>
  request(app).delete(`/api/settings/remove-profile-photo/${id}`).set(as(token));

const storedPhoto = async (id) => (await User.findById(id).lean()).profilePhoto;

// The reply holds exactly the message and the photo path
const expectPhotoOnly = (res, message, profilePhoto) => {
  expect(Object.keys(res.body).sort()).toEqual(["message", "profilePhoto"]);
  expect(res.body).toEqual({ message, profilePhoto });
  for (const field of SECRET_FIELDS) {
    expect(res.body).not.toHaveProperty(field);
  }
  expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$|reset-token-secret/);
};

const SET_TO_DEFAULT = "Profile photo set to default";

describe("DELETE /api/settings/remove-profile-photo/:id: the reply", () => {
  it("is only the message and icon for an Employee", async () => {
    const { urlPath } = uploadedPhoto();
    const ana = await account("ana", {
      profilePhoto: urlPath,
      employee: { gender: "Female" },
    });

    const res = await removePhoto(ana.user._id, ana.token);

    expect(res.status).toBe(200);
    expectPhotoOnly(res, SET_TO_DEFAULT, FEMALE);
    expect(await storedPhoto(ana.user._id)).toBe(FEMALE);
  });

  it("is only the message and the plain icon for an Admin", async () => {
    const hr = await account("hr", {
      role: "Admin",
      pageAccess: ADMIN_PAGE_KEYS,
      profilePhoto: uploadedPhoto().urlPath,
    });

    const res = await removePhoto(hr.user._id, hr.token);

    expect(res.status).toBe(200);
    expectPhotoOnly(res, SET_TO_DEFAULT, PLAIN);
    expect(await storedPhoto(hr.user._id)).toBe(PLAIN);
  });

  it("is only the message and the plain icon for the Super Admin", async () => {
    const boss = await account("admin", {
      role: "Super Admin",
      profilePhoto: uploadedPhoto().urlPath,
    });

    const res = await removePhoto(boss.user._id, boss.token);

    expect(res.status).toBe(200);
    expectPhotoOnly(res, SET_TO_DEFAULT, PLAIN);
    expect(await storedPhoto(boss.user._id)).toBe(PLAIN);
  });

  it("is only the message and icon when an Admin removes an employee's photo", async () => {
    const hr = await account("hr", {
      role: "Admin",
      pageAccess: ADMIN_PAGE_KEYS,
    });
    const ben = await account("ben", {
      profilePhoto: uploadedPhoto().urlPath,
      employee: { gender: "Male" },
    });

    const res = await removePhoto(ben.user._id, hr.token);

    expect(res.status).toBe(200);
    expectPhotoOnly(res, SET_TO_DEFAULT, MALE);
    expect(await storedPhoto(ben.user._id)).toBe(MALE);
  });

  it("sends no error details on a server error", async () => {
    const ana = await account("ana", { employee: { gender: "Male" } });
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest
      .spyOn(User.prototype, "save")
      .mockRejectedValueOnce(new Error("database is down"));

    const res = await removePhoto(ana.user._id, ana.token);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Internal server error" });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("DELETE /api/settings/remove-profile-photo/:id: the icon", () => {
  it("is male.svg for a Male employee", async () => {
    const ben = await account("ben", { employee: { gender: "Male" } });
    const res = await removePhoto(ben.user._id, ben.token);
    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toBe(MALE);
  });

  it("is female.svg for a Female employee", async () => {
    const ana = await account("ana", { employee: { gender: "Female" } });
    const res = await removePhoto(ana.user._id, ana.token);
    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toBe(FEMALE);
  });

  it("is user-circle.svg for an employee with no gender", async () => {
    const cy = await account("cy", { employee: {} });
    const res = await removePhoto(cy.user._id, cy.token);
    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toBe(PLAIN);
  });

  it("is user-circle.svg for an employee with no Employee record", async () => {
    const dee = await account("dee");
    const res = await removePhoto(dee.user._id, dee.token);
    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toBe(PLAIN);
  });

  it("follows the record linked by userId, even when its email differs", async () => {
    const ana = await account("ana", {
      employee: { gender: "Female", email: "ana.work@example.com" },
    });
    // An unlinked record with the account's own email must not win
    await Employee.create({
      firstName: "Other",
      lastName: "Record",
      email: "ana@example.com",
      gender: "Male",
    });

    const res = await removePhoto(ana.user._id, ana.token);

    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toBe(FEMALE);
  });

  it("falls back to the record with the account's email when none is linked", async () => {
    const ben = await account("ben");
    await Employee.create({
      firstName: "Ben",
      lastName: "Test",
      email: "ben@example.com",
      gender: "Male",
    });

    const res = await removePhoto(ben.user._id, ben.token);

    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toBe(MALE);
  });

  it("is user-circle.svg for an Admin and the Super Admin, whatever a linked record says", async () => {
    const hr = await account("hr", {
      role: "Admin",
      pageAccess: ADMIN_PAGE_KEYS,
      employee: { gender: "Female" },
    });
    const boss = await account("admin", {
      role: "Super Admin",
      employee: { gender: "Male" },
    });

    const hrRes = await removePhoto(hr.user._id, hr.token);
    const bossRes = await removePhoto(boss.user._id, boss.token);

    expect(hrRes.body.profilePhoto).toBe(PLAIN);
    expect(bossRes.body.profilePhoto).toBe(PLAIN);
  });
});

describe("DELETE /api/settings/remove-profile-photo/:id: files", () => {
  it("deletes the uploaded file", async () => {
    const { urlPath, filePath } = uploadedPhoto();
    const ana = await account("ana", {
      profilePhoto: urlPath,
      employee: { gender: "Female" },
    });
    expect(fs.existsSync(filePath)).toBe(true);

    const res = await removePhoto(ana.user._id, ana.token);

    expect(res.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("answers a second removal with the same icon and deletes nothing", async () => {
    const { urlPath } = uploadedPhoto();
    const ben = await account("ben", {
      profilePhoto: urlPath,
      employee: { gender: "Male" },
    });
    const first = await removePhoto(ben.user._id, ben.token);
    expect(first.status).toBe(200);

    const unlink = jest.spyOn(fs, "unlinkSync");
    const second = await removePhoto(ben.user._id, ben.token);

    expect(second.status).toBe(200);
    expectPhotoOnly(second, SET_TO_DEFAULT, MALE);
    expect(unlink).not.toHaveBeenCalled();
    expect(await storedPhoto(ben.user._id)).toBe(MALE);
  });

  it("treats an empty photo like an icon: 200 with the chosen icon", async () => {
    const ana = await account("ana", { employee: { gender: "Female" } });
    await User.updateOne({ _id: ana.user._id }, { $set: { profilePhoto: "" } });
    const unlink = jest.spyOn(fs, "unlinkSync");

    const res = await removePhoto(ana.user._id, ana.token);

    expect(res.status).toBe(200);
    expectPhotoOnly(res, SET_TO_DEFAULT, FEMALE);
    expect(unlink).not.toHaveBeenCalled();
    expect(await storedPhoto(ana.user._id)).toBe(FEMALE);
  });
});

describe("DELETE /api/settings/remove-profile-photo/:id: who may", () => {
  it("refuses another employee's photo with 403 and changes nothing", async () => {
    const { urlPath, filePath } = uploadedPhoto();
    const ana = await account("ana", {
      profilePhoto: urlPath,
      employee: { gender: "Female" },
    });
    const ben = await account("ben", { employee: { gender: "Male" } });

    const res = await removePhoto(ana.user._id, ben.token);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Access denied" });
    expect(await storedPhoto(ana.user._id)).toBe(urlPath);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("answers an unknown account 404 User not found", async () => {
    const boss = await account("admin", { role: "Super Admin" });

    const res = await removePhoto(
      String(new mongoose.Types.ObjectId()),
      boss.token,
    );

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "User not found" });
  });
});

describe("PUT /api/settings/users/:id/profile-photo: the reply", () => {
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const upload = (id, token) =>
    request(app)
      .put(`/api/settings/users/${id}/profile-photo`)
      .set(as(token))
      .attach("profilePhoto", png, {
        filename: "photo.png",
        contentType: "image/png",
      });

  // Files multer saved during the test, removed afterwards
  const trackNewUploads = () => {
    const before = new Set(
      fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [],
    );
    return () => {
      for (const name of fs.readdirSync(UPLOAD_DIR)) {
        if (!before.has(name)) tempFiles.push(path.join(UPLOAD_DIR, name));
      }
    };
  };

  it("is only the message and the new photo path", async () => {
    const ana = await account("ana", { employee: { gender: "Female" } });
    const track = trackNewUploads();

    const res = await upload(ana.user._id, ana.token);
    track();

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["message", "profilePhoto"]);
    expect(res.body.message).toBe("Profile photo updated");
    expect(res.body.profilePhoto).toMatch(/^\/uploads\/profile-photo-\d+\.png$/);
    for (const field of SECRET_FIELDS) {
      expect(res.body).not.toHaveProperty(field);
    }
  });

  it("sends no error details on a server error", async () => {
    const ana = await account("ana", { employee: { gender: "Female" } });
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest
      .spyOn(User.prototype, "save")
      .mockRejectedValueOnce(new Error("database is down"));
    const track = trackNewUploads();

    const res = await upload(ana.user._id, ana.token);
    track();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Server error" });
  });
});

// Friday batch, Group 2: the guard (requireSelfOrAdmin) runs before multer, so an
// Employee's upload to another account is refused and never written to disk
describe("PUT /api/settings/users/:id/profile-photo: who may", () => {
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  const upload = (id, token) =>
    request(app)
      .put(`/api/settings/users/${id}/profile-photo`)
      .set(as(token))
      .attach("profilePhoto", png, {
        filename: "photo.png",
        contentType: "image/png",
      });

  const uploadNames = () =>
    new Set(fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : []);

  it("refuses an Employee uploading to another employee with 403; nothing saved or written", async () => {
    const { urlPath } = uploadedPhoto();
    const ana = await account("ana", {
      profilePhoto: urlPath,
      employee: { gender: "Female" },
    });
    const ben = await account("ben", { employee: { gender: "Male" } });
    const before = uploadNames();

    const res = await upload(ana.user._id, ben.token);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Access denied" });
    expect(await storedPhoto(ana.user._id)).toBe(urlPath);
    expect(uploadNames()).toEqual(before);
  });

  it("refuses an Employee uploading to an Admin's account the same way", async () => {
    const hr = await account("hr", { role: "Admin", pageAccess: ADMIN_PAGE_KEYS });
    const ben = await account("ben", { employee: { gender: "Male" } });
    const photoBefore = await storedPhoto(hr.user._id);
    const before = uploadNames();

    const res = await upload(hr.user._id, ben.token);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Access denied" });
    expect(await storedPhoto(hr.user._id)).toBe(photoBefore);
    expect(uploadNames()).toEqual(before);
  });

  it("still lets the Employee upload its own photo", async () => {
    const ben = await account("ben", { employee: { gender: "Male" } });
    const before = uploadNames();

    const res = await upload(ben.user._id, ben.token);
    for (const name of uploadNames()) {
      if (!before.has(name)) tempFiles.push(path.join(UPLOAD_DIR, name));
    }

    expect(res.status).toBe(200);
    expect(await storedPhoto(ben.user._id)).toBe(res.body.profilePhoto);
  });
});
