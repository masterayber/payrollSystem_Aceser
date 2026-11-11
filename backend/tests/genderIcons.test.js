// Default profile icons by gender (utils/profileIcon.js): an Employee-role account on a
// default icon shows the icon for its Employee record's gender; the Super Admin and
// Admins show the plain user icon; an uploaded photo is never changed. Covers the
// rule itself, every save that sets a gender (sign-up, Add Employee, the admin edit,
// Settings > General), the trimmed Settings > General reply, and the one-time
// script backend/scripts/setGenderIcons.js.
const request = require("supertest");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../app");
const User = require("../models/authUsers");
const Employee = require("../models/employees");
const Settings = require("../models/settings");
const { pagesForRole } = require("../config/pages");
const {
  DEFAULT_ICON: PLAIN,
  MALE_ICON: MALE,
  FEMALE_ICON: FEMALE,
  isDefaultIcon,
  iconForGender,
  iconFor,
  nextProfilePhoto,
  defaultPhotoFor,
  refreshDefaultIcon,
} = require("../utils/profileIcon");
const {
  planGenderIcons,
  applyGenderIcons,
  describePlan,
} = require("../scripts/setGenderIcons");

const ADMIN_PAGE_KEYS = pagesForRole("Admin").map((page) => page.key);
const UPLOAD = "/uploads/profile-photo-123.png";
const PASSWORD = "Password123!";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([
    User.deleteMany({}),
    Employee.deleteMany({}),
    Settings.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

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
  { role = "Employee", profilePhoto, employee, extra = {} } = {},
) => {
  const user = await User.create({
    username,
    password: PASSWORD,
    email: `${username}@example.com`,
    role,
    status: "Active",
    ...(role === "Admin" ? { pageAccess: ADMIN_PAGE_KEYS } : {}),
    ...(profilePhoto !== undefined ? { profilePhoto } : {}),
    ...extra,
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

const storedPhoto = async (id) => (await User.findById(id).lean()).profilePhoto;
const storedGender = async (id) =>
  (await Employee.findOne({ userId: id }).lean()).gender;

describe("the rule (utils/profileIcon.js)", () => {
  it("isDefaultIcon: the three icons, empty and missing are default; anything else is not", () => {
    for (const photo of [PLAIN, MALE, FEMALE, "", null, undefined]) {
      expect(isDefaultIcon(photo)).toBe(true);
    }
    for (const photo of [UPLOAD, "/assets/other.svg", "https://x/y.png"]) {
      expect(isDefaultIcon(photo)).toBe(false);
    }
  });

  it("iconForGender: Male and Female get their icon; anything else the plain one", () => {
    expect(iconForGender("Male")).toBe(MALE);
    expect(iconForGender("Female")).toBe(FEMALE);
    for (const gender of ["", undefined, null, "Other", "male"]) {
      expect(iconForGender(gender)).toBe(PLAIN);
    }
  });

  it("iconFor: an Employee by gender; the Super Admin and Admins always plain", () => {
    expect(iconFor("Employee", "Female")).toBe(FEMALE);
    expect(iconFor("Admin", "Female")).toBe(PLAIN);
    expect(iconFor("Super Admin", "Male")).toBe(PLAIN);
  });

  it("nextProfilePhoto: an upload stays; a default icon follows the rule", () => {
    expect(nextProfilePhoto(UPLOAD, "Employee", "Male")).toBe(UPLOAD);
    expect(nextProfilePhoto(PLAIN, "Employee", "Male")).toBe(MALE);
    expect(nextProfilePhoto("", "Employee", "Female")).toBe(FEMALE);
    expect(nextProfilePhoto(FEMALE, "Admin", "Female")).toBe(PLAIN);
  });

  it("refreshDefaultIcon: sets the icon for the given gender and says whether it changed", async () => {
    const user = { role: "Employee", profilePhoto: PLAIN };
    expect(await refreshDefaultIcon(user, { gender: "Male" })).toEqual({
      profilePhoto: MALE,
      changed: true,
    });
    expect(user.profilePhoto).toBe(MALE);
    expect(await refreshDefaultIcon(user, { gender: "Male" })).toEqual({
      profilePhoto: MALE,
      changed: false,
    });
  });

  it("refreshDefaultIcon: leaves an upload alone, and resets an admin's gender icon", async () => {
    const uploaded = { role: "Employee", profilePhoto: UPLOAD };
    expect(await refreshDefaultIcon(uploaded, { gender: "Female" })).toEqual({
      profilePhoto: UPLOAD,
      changed: false,
    });
    expect(uploaded.profilePhoto).toBe(UPLOAD);

    const admin = { role: "Admin", profilePhoto: FEMALE };
    await refreshDefaultIcon(admin, { gender: "Female" });
    expect(admin.profilePhoto).toBe(PLAIN);
  });

  it("refreshDefaultIcon and defaultPhotoFor look the gender up by userId, else by email", async () => {
    const linked = await User.create({
      username: "ana",
      password: PASSWORD,
      email: "ana@example.com",
    });
    await Employee.create({
      userId: linked._id,
      firstName: "A",
      lastName: "T",
      email: "ana.work@example.com",
      gender: "Female",
    });
    const byEmail = await User.create({
      username: "ben",
      password: PASSWORD,
      email: "ben@example.com",
    });
    await Employee.create({ firstName: "B", lastName: "T", email: "ben@example.com", gender: "Male" });

    expect(await defaultPhotoFor(linked)).toBe(FEMALE);
    expect(await defaultPhotoFor(byEmail)).toBe(MALE);
    expect(await defaultPhotoFor({ role: "Admin", _id: linked._id })).toBe(PLAIN);

    const plain = { _id: linked._id, email: linked.email, role: "Employee", profilePhoto: PLAIN };
    await refreshDefaultIcon(plain);
    expect(plain.profilePhoto).toBe(FEMALE);
  });
});

describe("POST /api/employee/update-info (sign-up)", () => {
  const signupAndInfo = async (gender) => {
    const signup = await request(app).post("/api/auth/signup").send({
      firstName: "New",
      lastName: "User",
      email: "new@example.com",
      username: "newuser",
      password: PASSWORD,
    });
    return request(app)
      .post("/api/employee/update-info")
      .set(as(signup.body.signupToken))
      .send({
        birthday: "1995-05-05",
        contactNumber: "09170000000",
        gender,
        contactFirstName: "Ana",
        contactLastName: "Cruz",
        contactEmergency: "09171111111",
        contactAddress: "Manila",
      });
  };

  it.each([
    ["Male", MALE],
    ["Female", FEMALE],
    ["", PLAIN],
  ])("gives gender %p the icon %s", async (gender, icon) => {
    const res = await signupAndInfo(gender);

    expect(res.status).toBe(200);
    const user = await User.findOne({ username: "newuser" }).lean();
    expect(user.profilePhoto).toBe(icon);
  });

  it("refuses a login token (no signup token) and sets no icon", async () => {
    const ana = await account("ana", { employee: {} });
    const token = jwt.sign({ userId: ana.user._id, role: "Employee" }, process.env.JWT_SECRET);

    const res = await request(app)
      .post("/api/employee/update-info")
      .set(as(token))
      .send({ gender: "Female" });

    expect(res.status).toBe(401);
    expect(await storedPhoto(ana.user._id)).toBe(PLAIN);
  });
});

describe("POST /api/employee/add-employee-via-admin", () => {
  const add = (token, extra = {}) =>
    request(app)
      .post("/api/employee/add-employee-via-admin")
      .set(as(token))
      .send({
        firstName: "Rico",
        lastName: "Test",
        employeeId: "AC-001",
        email: "rico@example.com",
        username: "rico",
        password: PASSWORD,
        employmentType: "Probationary",
        startDate: "2026-11-02",
        basicPay: 20000,
        ...extra,
      });

  it.each([
    ["Male", MALE],
    ["Female", FEMALE],
    [undefined, PLAIN],
  ])("gives gender %p the icon %s, in the record and the reply", async (gender, icon) => {
    const boss = await account("admin", { role: "Super Admin" });

    const res = await add(boss.token, gender ? { gender } : {});

    expect(res.status).toBe(201);
    expect(res.body.user.profilePhoto).toBe(icon);
    const rico = await User.findOne({ username: "rico" }).lean();
    expect(rico.profilePhoto).toBe(icon);
  });

  it("ignores a profilePhoto sent in the body", async () => {
    const hr = await account("hr", { role: "Admin" });

    const res = await add(hr.token, { gender: "Female", profilePhoto: UPLOAD });

    expect(res.status).toBe(201);
    expect((await User.findOne({ username: "rico" }).lean()).profilePhoto).toBe(FEMALE);
  });

  it("refuses an employee with 403 and creates nothing", async () => {
    const ana = await account("ana", { employee: { gender: "Female" } });

    const res = await add(ana.token, { gender: "Male" });

    expect(res.status).toBe(403);
    expect(await User.exists({ username: "rico" })).toBeNull();
  });
});

describe("PUT /api/employee/edit-employee-via-admin/:id", () => {
  const edit = (id, token, body) =>
    request(app)
      .put(`/api/employee/edit-employee-via-admin/${id}`)
      .set(as(token))
      .send(body);

  it("switches a default icon on a gender change; the reply is unchanged", async () => {
    const boss = await account("admin", { role: "Super Admin" });
    const ben = await account("ben", {
      profilePhoto: MALE,
      employee: { gender: "Male" },
    });

    const res = await edit(ben.user._id, boss.token, { gender: "Female" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Employee updated successfully" });
    expect(await storedGender(ben.user._id)).toBe("Female");
    expect(await storedPhoto(ben.user._id)).toBe(FEMALE);
  });

  it("gives the plain icon when the gender is cleared, for an Admin with the tick", async () => {
    const hr = await account("hr", { role: "Admin" });
    const ana = await account("ana", {
      profilePhoto: FEMALE,
      employee: { gender: "Female" },
    });

    const res = await edit(ana.user._id, hr.token, { gender: "" });

    expect(res.status).toBe(200);
    expect(await storedPhoto(ana.user._id)).toBe(PLAIN);
  });

  it("leaves an uploaded photo alone", async () => {
    const boss = await account("admin", { role: "Super Admin" });
    const ben = await account("ben", {
      profilePhoto: UPLOAD,
      employee: { gender: "Male" },
    });

    const res = await edit(ben.user._id, boss.token, { gender: "Female" });

    expect(res.status).toBe(200);
    expect(await storedGender(ben.user._id)).toBe("Female");
    expect(await storedPhoto(ben.user._id)).toBe(UPLOAD);
  });

  it("changes no icon when the gender is not changed", async () => {
    const boss = await account("admin", { role: "Super Admin" });
    const ben = await account("ben", {
      profilePhoto: PLAIN,
      employee: { gender: "Male" },
    });

    await edit(ben.user._id, boss.token, { gender: "Male", contactNumber: "0917" });
    await edit(ben.user._id, boss.token, { contactNumber: "0918" });

    expect(await storedPhoto(ben.user._id)).toBe(PLAIN);
  });

  it("refuses an employee with 403 and changes nothing", async () => {
    const ana = await account("ana", { employee: { gender: "Female" } });
    const ben = await account("ben", {
      profilePhoto: MALE,
      employee: { gender: "Male" },
    });

    const res = await edit(ben.user._id, ana.token, { gender: "Female" });

    expect(res.status).toBe(403);
    expect(await storedGender(ben.user._id)).toBe("Male");
    expect(await storedPhoto(ben.user._id)).toBe(MALE);
  });
});

describe("PUT /api/settings/updateGeneralSettings/:id: the icon", () => {
  const update = (id, token, employee) =>
    request(app)
      .put(`/api/settings/updateGeneralSettings/${id}`)
      .set(as(token))
      .send({ employee });

  it("switches an employee's own default icon on a gender change, and replies with it", async () => {
    const ana = await account("ana", { employee: { gender: "Male" } });

    const res = await update(ana.user._id, ana.token, { gender: "Female" });

    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toBe(FEMALE);
    expect(res.body.employee.gender).toBe("Female");
    expect(await storedPhoto(ana.user._id)).toBe(FEMALE);
  });

  it("switches it when an Admin edits an employee's gender", async () => {
    const hr = await account("hr", { role: "Admin" });
    const ben = await account("ben", {
      profilePhoto: FEMALE,
      employee: { gender: "Female" },
    });

    const res = await update(ben.user._id, hr.token, { gender: "Male" });

    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toBe(MALE);
    expect(await storedPhoto(ben.user._id)).toBe(MALE);
  });

  it("leaves an uploaded photo alone", async () => {
    const ana = await account("ana", {
      profilePhoto: UPLOAD,
      employee: { gender: "Male" },
    });

    const res = await update(ana.user._id, ana.token, { gender: "Female" });

    expect(res.status).toBe(200);
    expect(res.body.profilePhoto).toBe(UPLOAD);
    expect(await storedPhoto(ana.user._id)).toBe(UPLOAD);
  });

  it("changes no icon when the gender is not changed", async () => {
    const ana = await account("ana", { employee: { gender: "Female" } });

    const same = await update(ana.user._id, ana.token, { gender: "Female" });
    const other = await update(ana.user._id, ana.token, { contactNumber: "0917" });

    expect(same.body.profilePhoto).toBe(PLAIN);
    expect(other.body.profilePhoto).toBe(PLAIN);
    expect(await storedPhoto(ana.user._id)).toBe(PLAIN);
  });

  it.each([["Admin"], ["Super Admin"]])(
    "keeps or resets the %s to the plain icon on a gender change",
    async (role) => {
      const kept = await account("kept", { role, employee: { gender: "Male" } });
      const reset = await account("reset", {
        role,
        profilePhoto: FEMALE,
        employee: { gender: "Female" },
      });

      const keptRes = await update(kept.user._id, kept.token, { gender: "Female" });
      const resetRes = await update(reset.user._id, reset.token, { gender: "Male" });

      expect(keptRes.status).toBe(200);
      expect(keptRes.body.profilePhoto).toBe(PLAIN);
      expect(resetRes.body.profilePhoto).toBe(PLAIN);
      expect(await storedPhoto(kept.user._id)).toBe(PLAIN);
      expect(await storedPhoto(reset.user._id)).toBe(PLAIN);
    },
  );

  it("refuses another employee with 403 and changes nothing", async () => {
    const ana = await account("ana", { employee: { gender: "Female" } });
    const ben = await account("ben", {
      profilePhoto: MALE,
      employee: { gender: "Male" },
    });

    const res = await update(ben.user._id, ana.token, { gender: "Female" });

    expect(res.status).toBe(403);
    expect(await storedGender(ben.user._id)).toBe("Male");
    expect(await storedPhoto(ben.user._id)).toBe(MALE);
  });
});

describe("PUT /api/settings/updateGeneralSettings/:id: the reply", () => {
  const SECRET_FIELDS = [
    "password",
    "resetToken",
    "pageAccess",
    "payAccess",
    "mustChangePassword",
    "linkedEmployeeId",
    "createdBy",
  ];

  const expectTrimmed = (res, email) => {
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ["_id", "email", "employee", "profilePhoto", "settings"].sort(),
    );
    expect(res.body.email).toBe(email);
    for (const field of SECRET_FIELDS) {
      expect(res.body).not.toHaveProperty(field);
    }
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$|reset-token-secret/);
  };

  it("is only _id, email, profilePhoto, employee and settings for an Admin's own edit", async () => {
    const boss = await account("admin", { role: "Super Admin" });
    const ana = await account("ana", { employee: { gender: "Female" } });
    const hr = await account("hr", {
      role: "Admin",
      employee: { gender: "Male" },
      extra: {
        resetToken: "reset-token-secret",
        payAccess: [ana.user._id],
        mustChangePassword: false,
        linkedEmployeeId: ana.user._id,
        createdBy: boss.user._id,
      },
    });

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${hr.user._id}`)
      .set(as(hr.token))
      .send({ employee: { contactNumber: "0917" } });

    expectTrimmed(res, "hr@example.com");
    expect(String(res.body._id)).toBe(String(hr.user._id));
    expect(res.body.profilePhoto).toBe(PLAIN);
    expect(res.body.employee.contactNumber).toBe("0917");
  });

  it("is the same shape when an admin edits an employee", async () => {
    const boss = await account("admin", { role: "Super Admin" });
    const ana = await account("ana", {
      employee: { gender: "Female" },
      extra: { resetToken: "reset-token-secret", mustChangePassword: true },
    });
    await Settings.create({
      userId: ana.user._id,
      general: { jobDescription: { position: "Staff", basicPay: 20000 } },
    });

    const res = await request(app)
      .put(`/api/settings/updateGeneralSettings/${ana.user._id}`)
      .set(as(boss.token))
      .send({ email: "ana.new@example.com", employee: { gender: "Male" } });

    expectTrimmed(res, "ana.new@example.com");
    expect(res.body.profilePhoto).toBe(MALE);
    expect(res.body.settings.general.jobDescription.position).toBe("Staff");
  });
});

describe("backend/scripts/setGenderIcons.js", () => {
  const raw = (username, fields) =>
    User.create({
      username,
      password: PASSWORD,
      email: `${username}@example.com`,
      status: "Active",
      ...fields,
    });

  // One account per case
  const seed = async () => {
    const people = {
      maleOnPlain: await raw("m1", { role: "Employee" }),
      femaleOnPlain: await raw("f1", { role: "Employee" }),
      femaleOnMale: await raw("f2", { role: "Employee", profilePhoto: MALE }),
      maleRight: await raw("m2", { role: "Employee", profilePhoto: MALE }),
      byEmail: await raw("m3", { role: "Employee", profilePhoto: "" }),
      noRecord: await raw("n1", { role: "Employee", profilePhoto: FEMALE }),
      upload: await raw("u1", { role: "Employee", profilePhoto: UPLOAD }),
      admin: await raw("a1", { role: "Admin", profilePhoto: FEMALE }),
      boss: await raw("s1", { role: "Super Admin" }),
    };
    const record = (user, gender, linked = true) =>
      Employee.create({
        ...(linked ? { userId: user._id } : {}),
        firstName: user.username,
        lastName: "Test",
        email: user.email,
        gender,
      });
    await record(people.maleOnPlain, "Male");
    await record(people.femaleOnPlain, "Female");
    await record(people.femaleOnMale, "Female");
    await record(people.maleRight, "Male");
    await record(people.byEmail, "Male", false);
    await record(people.upload, "Female");
    await record(people.admin, "Female");
    await record(people.boss, "Male");
    return people;
  };

  const photos = async (people) => {
    const out = {};
    for (const [key, user] of Object.entries(people)) {
      out[key] = await storedPhoto(user._id);
    }
    return out;
  };

  it("plans the changes and counts them, without writing anything", async () => {
    const people = await seed();
    const before = await photos(people);

    const plan = await planGenderIcons();

    expect(plan.changes).toHaveLength(6);
    expect(plan.uploadsKept).toBe(1);
    expect(plan.unchanged).toBe(2);
    expect(describePlan(plan)).toEqual([
      "female -> user-circle: 2",
      "male -> female: 1",
      "no photo -> male: 1",
      "user-circle -> female: 1",
      "user-circle -> male: 1",
      "Uploaded photos left alone: 1",
      "Default icons already right: 2",
    ]);
    expect(await photos(people)).toEqual(before);
  });

  it("writes the changes with apply, leaves the upload, and a rerun has nothing to change", async () => {
    const people = await seed();

    expect(await applyGenderIcons()).toBe(6);

    expect(await photos(people)).toEqual({
      maleOnPlain: MALE,
      femaleOnPlain: FEMALE,
      femaleOnMale: FEMALE,
      maleRight: MALE,
      byEmail: MALE,
      noRecord: PLAIN,
      upload: UPLOAD,
      admin: PLAIN,
      boss: PLAIN,
    });

    const rerun = await planGenderIcons();
    expect(rerun.changes).toEqual([]);
    expect(rerun.uploadsKept).toBe(1);
    expect(await applyGenderIcons()).toBe(0);
  });

  it("does not overwrite a photo uploaded after the plan was made", async () => {
    const people = await seed();
    const plan = await planGenderIcons();
    await User.updateOne({ _id: people.maleOnPlain._id }, { profilePhoto: UPLOAD });

    expect(await applyGenderIcons(plan)).toBe(5);
    expect(await storedPhoto(people.maleOnPlain._id)).toBe(UPLOAD);
  });

  it("can be required without connecting or exiting", () => {
    const exit = jest.spyOn(process, "exit").mockImplementation(() => {});
    jest.isolateModules(() => require("../scripts/setGenderIcons"));
    expect(exit).not.toHaveBeenCalled();
  });
});
