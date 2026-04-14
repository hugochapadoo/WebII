import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";
import { AppError } from "../utils/AppError.js";
import { config } from "../config/index.js";
import { notificationService } from "../services/notification.service.js";

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    config.jwtAccessSecret,
    {
      expiresIn: config.jwtAccessExpires,
    }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    config.jwtRefreshSecret,
    {
      expiresIn: config.jwtRefreshExpires,
    }
  );
};

const sanitizeUser = (user) => {
  return {
    _id: user._id,
    email: user.email,
    role: user.role,
    status: user.status,
    company: user.company,
    name: user.name,
    lastName: user.lastName,
    phone: user.phone,
    nif: user.nif,
    birthDate: user.birthDate,
    address: user.address,
    fullName: user.fullName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const register = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const existingUser = await User.findOne({ email, deleted: false });

    if (existingUser) {
      return next(AppError.conflict("User already exists"));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();

    const user = await User.create({
      email,
      password: hashedPassword,
      verificationCode,
      verificationAttempts: 3,
      status: "pending",
      role: "admin",
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    notificationService.emit("user:registered", user);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        email: user.email,
        status: user.status,
        role: user.role,
        accessToken,
        refreshToken,
        verificationCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const validateAccount = async (req, res, next) => {
  try {
    const { code } = req.body;

    const user = await User.findById(req.user._id);

    if (!user || user.deleted) {
      return next(AppError.notFound("User not found"));
    }

    if (user.status === "verified") {
      return next(AppError.badRequest("User already verified"));
    }

    if (user.verificationAttempts <= 0) {
      return next(AppError.tooManyRequests("No verification attempts remaining"));
    }

    if (user.verificationCode !== code) {
      user.verificationAttempts -= 1;
      await user.save();

      if (user.verificationAttempts <= 0) {
        return next(AppError.tooManyRequests("No verification attempts remaining"));
      }

      return next(
        AppError.badRequest(`Invalid verification code. Attempts left: ${user.verificationAttempts}`)
      );
    }

    user.status = "verified";
    user.verificationCode = null;
    user.verificationAttempts = 0;
    await user.save();

    notificationService.emit("user:verified", user);

    res.json({
      success: true,
      message: "User verified successfully",
      data: {
        email: user.email,
        status: user.status,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, deleted: false });

    if (!user) {
      return next(AppError.unauthorized("Invalid credentials"));
    }

    if (user.status !== "verified") {
      return next(AppError.unauthorized("User is not verified"));
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return next(AppError.unauthorized("Invalid credentials"));
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: sanitizeUser(user),
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const completeRegister = async (req, res, next) => {
  try {
    const { name, lastName, phone, nif, birthDate, address } = req.body;

    const user = await User.findById(req.user._id);

    if (!user || user.deleted) {
      return next(AppError.notFound("User not found"));
    }

    user.name = name;
    user.lastName = lastName;
    user.phone = phone;
    user.nif = nif;
    user.birthDate = birthDate;
    user.address = address;

    await user.save();

    res.json({
      success: true,
      message: "User profile completed successfully",
      data: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const assignCompany = async (req, res, next) => {
  try {
    const { cif, name, address, isFreelance } = req.body;

    const user = await User.findById(req.user._id);

    if (!user || user.deleted) {
      return next(AppError.notFound("User not found"));
    }

    let company;

    if (isFreelance) {
      company = await Company.findOne({ cif: user.nif, deleted: false });

      if (!company) {
        company = await Company.create({
          cif: user.nif,
          name: user.fullName || `${user.name} ${user.lastName}`.trim(),
          owner: user._id,
          address: user.address,
          isFreelance: true,
        });
      }

      user.company = company._id;
      user.role = "admin";
      await user.save();

      return res.json({
        success: true,
        message: "Freelance company assigned successfully",
        data: company,
      });
    }

    company = await Company.findOne({ cif, deleted: false });

    if (!company) {
      company = await Company.create({
        cif,
        name,
        owner: user._id,
        address,
        isFreelance: false,
      });

      user.company = company._id;
      user.role = "admin";
      await user.save();

      return res.json({
        success: true,
        message: "Company created and assigned successfully",
        data: company,
      });
    }

    user.company = company._id;
    user.role = "guest";
    await user.save();

    res.json({
      success: true,
      message: "Company assigned successfully",
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("company")
      .select("-password -refreshToken");

    if (!user || user.deleted) {
      return next(AppError.notFound("User not found"));
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret);

    const user = await User.findById(payload.id);

    if (!user || user.deleted) {
      return next(AppError.notFound("User not found"));
    }

    if (user.refreshToken !== refreshToken) {
      return next(AppError.unauthorized("Invalid refresh token"));
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    next(AppError.unauthorized("Invalid or expired refresh token"));
  }
};

export const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || user.deleted) {
      return next(AppError.notFound("User not found"));
    }

    user.refreshToken = null;
    await user.save();

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
};

export const uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(AppError.badRequest("File is required"));
    }

    const user = await User.findById(req.user._id);

    if (!user || user.deleted) {
      return next(AppError.notFound("User not found"));
    }

    if (!user.company) {
      return next(AppError.badRequest("User has no company assigned"));
    }

    const company = await Company.findById(user.company);

    if (!company || company.deleted) {
      return next(AppError.notFound("Company not found"));
    }

    if (company.owner.toString() !== user._id.toString()) {
      return next(AppError.forbidden("Only the company owner can upload the logo"));
    }

    company.logo = req.file.path;
    await company.save();

    res.json({
      success: true,
      message: "Logo uploaded successfully",
      data: {
        logo: company.logo,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMe = async (req, res, next) => {
  try {
    const soft = req.query.soft === "true";

    const user = await User.findById(req.user._id);

    if (!user || user.deleted) {
      return next(AppError.notFound("User not found"));
    }

    if (soft) {
      user.deleted = true;
      user.refreshToken = null;
      await user.save();

      notificationService.emit("user:deleted", user);

      return res.json({
        success: true,
        message: "User soft deleted successfully",
      });
    }

    await User.findByIdAndDelete(user._id);

    notificationService.emit("user:deleted", user);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    if (!user || user.deleted) {
      return next(AppError.notFound("User not found"));
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      return next(AppError.badRequest("Current password is incorrect"));
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const inviteUser = async (req, res, next) => {
  try {
    const { email } = req.body;

    const existingUser = await User.findOne({ email, deleted: false });

    if (existingUser) {
      return next(AppError.conflict("User already exists"));
    }

    if (!req.user.company) {
      return next(AppError.badRequest("Admin has no company assigned"));
    }

    const temporaryPassword = "12345678";
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const verificationCode = generateVerificationCode();

    const user = await User.create({
      email,
      password: hashedPassword,
      role: "guest",
      company: req.user.company,
      verificationCode,
      verificationAttempts: 3,
      status: "pending",
    });

    notificationService.emit("user:invited", user);

    res.status(201).json({
      success: true,
      message: "User invited successfully",
      data: {
        email: user.email,
        role: user.role,
        verificationCode,
      },
    });
  } catch (error) {
    next(error);
  }
};