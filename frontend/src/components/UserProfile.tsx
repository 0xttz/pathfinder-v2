import React, { useState, useEffect } from "react";

const UserProfile = () => {
  const [profile, setProfile] = useState({
    age: "",
    gender: "",
    location: "",
  });

  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem("userProfile");
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
    } catch (error) {
      console.error("Failed to parse user profile from localStorage", error);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile((prevProfile) => {
      const updatedProfile = { ...prevProfile, [name]: value };
      localStorage.setItem("userProfile", JSON.stringify(updatedProfile));
      return updatedProfile;
    });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        About Me Details
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="age"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Age
          </label>
          <input
            type="text"
            id="age"
            name="age"
            value={profile.age}
            onChange={handleChange}
            className="w-full p-2 mt-1 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label
            htmlFor="gender"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Gender
          </label>
          <input
            type="text"
            id="gender"
            name="gender"
            value={profile.gender}
            onChange={handleChange}
            className="w-full p-2 mt-1 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
        <div>
          <label
            htmlFor="location"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={profile.location}
            onChange={handleChange}
            className="w-full p-2 mt-1 border rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600"
          />
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 