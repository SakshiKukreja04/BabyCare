import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getBabiesByParent } from "@/lib/firestore";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Mail, Phone, Baby, Calendar, Heart, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  createdAt?: any;
  photoURL?: string;
}

interface Baby {
  id: string;
  name?: string;
  dob?: string;
  gestationalAge?: string;
  currentWeight?: number;
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [babies, setBabies] = useState<Baby[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch user profile from Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        } else {
          // Fallback to auth user data if Firestore doc doesn't exist
          setUserProfile({
            name: user.displayName || "User",
            email: user.email || "",
            photoURL: user.photoURL || undefined,
          });
        }

        // Fetch babies list
        const babiesData = await getBabiesByParent(user.uid);
        setBabies(babiesData);
      } catch (error) {
        console.error("Error fetching profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateAge = (dob: string) => {
    if (!dob) return "N/A";
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? `${age} year${age !== 1 ? "s" : ""}` : "Less than 1 year";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 pb-8">
        {/* Header Section with Avatar */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                {userProfile?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase() || "U"}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{userProfile?.name}</h1>
                <p className="text-gray-600 mt-1">👨‍👩‍👧‍👦 Parent Account</p>
                <Badge className="mt-3 bg-green-100 text-green-800 hover:bg-green-100">
                  ✓ Active
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-3">Member since</p>
              <p className="font-semibold text-gray-900">{formatDate(userProfile?.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Personal Information Card */}
          <div className="md:col-span-2 space-y-6">
            <Card className="border-blue-100 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-100">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Heart className="w-5 h-5 text-red-500" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Email */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Email Address</p>
                    <p className="text-lg font-semibold text-gray-900">{userProfile?.email}</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Phone Number</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {userProfile?.phone || "Not provided"}
                    </p>
                  </div>
                </div>

                {/* Member Since */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Member Since</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatDate(userProfile?.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Babies Summary Card */}
            <Card className="border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-100 border-b border-indigo-100">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Baby className="w-5 h-5 text-pink-500" />
                  Your Babies ({babies.length})
                </CardTitle>
                <CardDescription>Manage and monitor your babies</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {babies.length > 0 ? (
                  <div className="space-y-3">
                    {babies.map((baby) => (
                      <div
                        key={baby.id}
                        className="p-4 border border-indigo-100 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                        onClick={() => navigate("/baby-profile")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-lg">
                              👶 {baby.name || "Baby"}
                            </h3>
                            <div className="flex gap-3 mt-2">
                              {baby.dob && (
                                <Badge variant="outline" className="bg-blue-50">
                                  Age: {calculateAge(baby.dob)}
                                </Badge>
                              )}
                              {baby.currentWeight && (
                                <Badge variant="outline" className="bg-green-50">
                                  Weight: {baby.currentWeight}kg
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-2xl">👼</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">No babies added yet</p>
                    <Button onClick={() => navigate("/baby-profile")} variant="outline">
                      Add Your First Baby
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats and Actions */}
          <div className="space-y-6">
            {/* Stats Card */}
            <Card className="border-green-100 shadow-sm">
              <CardHeader className="bg-gradient-to-br from-green-50 to-emerald-100 border-b border-green-100">
                <CardTitle className="text-lg">📊 Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">{babies.length}</p>
                  <p className="text-sm text-gray-600 mt-1">Baby Profiles</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-3xl font-bold text-purple-600">∞</p>
                  <p className="text-sm text-gray-600 mt-1">Care Records</p>
                </div>
              </CardContent>
            </Card>

            {/* Account Settings Card */}
            <Card className="border-orange-100 shadow-sm">
              <CardHeader className="bg-gradient-to-br from-orange-50 to-yellow-100 border-b border-orange-100">
                <CardTitle className="text-lg">⚙️ Account</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-blue-50"
                  onClick={() => navigate("/dashboard")}
                >
                  📈 Dashboard
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start hover:bg-green-50"
                  onClick={() => navigate("/chatbot")}
                >
                  💬 AI Chatbot
                </Button>
                <Separator className="my-2" />
                <Button
                  variant="destructive"
                  className="w-full justify-start gap-2"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>

            {/* Account Status */}
            <Card className="border-green-100 shadow-sm">
              <CardHeader className="bg-gradient-to-br from-green-50 to-lime-100 border-b border-green-100">
                <CardTitle className="text-base">✨ Account Status</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Profile Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Notifications Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span className="text-sm text-gray-700">Full Access</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
