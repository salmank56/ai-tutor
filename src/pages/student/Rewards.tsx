import { useState, useEffect, useRef } from "react";
import { Trophy, Star, Calendar, Clock, BookOpen } from "lucide-react";
import apiClient from "@/config/ApiConfig";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PDFDocument, rgb } from "pdf-lib";
import { DownloadIcon, ShareIcon, CertificateIcon } from "@/components/Icons";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import fontkit from "@pdf-lib/fontkit";
import certTemplateUrl from "/src/assets/Certificate_Template.pdf?url";
import markerFontUrl from "/src/assets/fonts/lumiosbrush-regular.otf?url";

// Describes a single achievement from your API
interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  pointValue: number;
  rewardClaimed: boolean;
  awardedAt?: string; // ISO date string
  iconUrl?: string; // The URL for the achievement's icon
  threshold?: number;
}

// Describes the categorized data structure from the achievements API
interface AchievementCategory {
  category: string;
  earned: Achievement[];
  available: Achievement[];
}

interface UserStats {
  userId: string;
  totalLoginDays: number;
  currentStreak: number;
  lastLoginDate: string;
  totalUsageSec: number;
  totalTopicsDone: number;
  totalPoints: number;
  updatedAt: string;
}

// --- Component Props ---

interface AchievementCardProps {
  achievement: Achievement;
  isEarned: boolean;
  userStats: UserStats | null;
}

// --- Main Rewards Component ---

const Rewards = (): JSX.Element => {
  const [achievements, setAchievements] = useState<AchievementCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [_error, setError] = useState<string | null>(null);
  const [_totalPoints, _setTotalPoints] = useState<number>(0);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [claimingReward, setClaimingReward] = useState<string | null>(null);
  const [tab, setTab] = useState<"rewards" | "certifications">("rewards");

  const [certificates, setCertificates] = useState(
    Array(12).fill({
      issueDate: "Jun 25, 2025",
      title: "Deep Learning Certificate",
      studentName: "Muhammad Hamza",
      description:
        "In recognition of their successful completion of five engaging topics in Reading Mode with enthusiasm and consistent effort in reading and understanding.",
      pdfUrl: null,
    })
  );

  // Static data defining the level structure
  // const levelData: Level[] = [
  //   {
  //     name: "Initiate",
  //     range: "0-100",
  //     points: 100,
  //     color: "green",
  //     minPoints: 0,
  //     maxPoints: 100,
  //   },
  //   {
  //     name: "Apprentice",
  //     range: "100-250",
  //     points: 250,
  //     color: "green",
  //     minPoints: 100,
  //     maxPoints: 250,
  //   },
  //   {
  //     name: "Strategist",
  //     range: "250-500",
  //     points: 500,
  //     color: "teal",
  //     minPoints: 250,
  //     maxPoints: 500,
  //   },
  //   {
  //     name: "Specialist",
  //     range: "500-1000",
  //     points: 1000,
  //     color: "blue",
  //     minPoints: 500,
  //     maxPoints: 1000,
  //   },
  //   {
  //     name: "Virtuoso",
  //     range: "1000-2000",
  //     points: 2000,
  //     color: "blue",
  //     minPoints: 1000,
  //     maxPoints: 2000,
  //   },
  //   {
  //     name: "Mastermind",
  //     range: "2000+",
  //     points: 2000,
  //     color: "purple",
  //     minPoints: 2000,
  //     maxPoints: Infinity,
  //   },
  // ];

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      setError(null);
      const aiTutorUserString = localStorage.getItem("AiTutorUser");
      if (!aiTutorUserString) {
        setError("User not found. Please log in.");
        setLoading(false);
        return;
      }
      const aiTutorUser = JSON.parse(aiTutorUserString);
      const userId = aiTutorUser.id;
      if (!userId) {
        setError("User not found. Please log in again.");
        setLoading(false);
        return;
      }
      const response = await apiClient.get<{
        status: string;
        data: { achievements: AchievementCategory[]; userStats: UserStats };
      }>(`/users/${userId}/achievements`);

      console.log("Achievements response:", response.data);

      if (response.data.status === "success") {
        const { achievements, userStats } = response.data.data;
        setAchievements(achievements);
        setUserStats(userStats);
      } else {
        setError("Failed to load achievements");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          "Failed to load achievements. Please try again."
      );
      console.error("Error fetching achievements:", err);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (achievementKey: string) => {
    try {
      setClaimingReward(achievementKey);
      setError(null);
      const aiTutorUserString = localStorage.getItem("AiTutorUser");
      if (!aiTutorUserString) {
        setError("Cannot claim reward: User not found.");
        return;
      }
      const aiTutorUser = JSON.parse(aiTutorUserString);
      const userId = aiTutorUser.id;
      if (!userId) {
        setError("Cannot claim reward: User not found.");
        return;
      }
      await apiClient.post(
        `/users/${userId}/achievements/${achievementKey}/claim`
      );
      await fetchAchievements();
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        "Failed to claim reward. Please try again.";
      setError(errorMessage);
      console.error("Error claiming reward:", err);
    } finally {
      setClaimingReward(null);
    }
  };

  const modifyPDF = async (cert: (typeof certificates)[0]) => {
    try {
      const pdfRes = await fetch(certTemplateUrl);
      if (!pdfRes.ok) return null;
      const pdfBytes = await pdfRes.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);

      pdfDoc.registerFontkit(fontkit);

      const [firstPage] = pdfDoc.getPages();
      const { width } = firstPage.getSize();

      const fontRes = await fetch(markerFontUrl);
      if (!fontRes.ok) return null;
      const fontBytes = await fontRes.arrayBuffer();
      const customFont = await pdfDoc.embedFont(fontBytes);
      const helvetica = await pdfDoc.embedFont("Helvetica");
      const helveticabold = await pdfDoc.embedFont("Helvetica-Bold");

      // Name
      const nameFontSize = 80;
      const nameTextWidth = customFont.widthOfTextAtSize(
        cert.studentName,
        nameFontSize
      );
      const nameX = (width - nameTextWidth) / 2;

      firstPage.drawText(cert.studentName, {
        x: nameX,
        y: 250,
        size: nameFontSize,
        font: customFont,
        color: rgb(1, 0.69, 0.17),
      });

      // Description
      const descFontSize = 16;
      const maxWidth = width * 0.6;
      const words = cert.description.split(" ");
      const lines: string[] = [];
      let line = "";

      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const testWidth = helvetica.widthOfTextAtSize(testLine, descFontSize);
        if (testWidth < maxWidth) {
          line = testLine;
        } else {
          lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);

      let y = 200;
      const lineHeight = descFontSize + 6;

      for (const descLine of lines) {
        const lineWidth = helvetica.widthOfTextAtSize(descLine, descFontSize);
        const x = (width - lineWidth) / 2;
        firstPage.drawText(descLine, {
          x,
          y,
          size: descFontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
      }

      // Issue Date
      const issueFontSize = 16;
      const issueText = `Issued on ${cert.issueDate}`;
      const issueWidth = helvetica.widthOfTextAtSize(issueText, issueFontSize);
      const issueX = (width - issueWidth) / 2;

      firstPage.drawText(issueText, {
        x: issueX,
        y: y - 20,
        size: issueFontSize,
        font: helveticabold,
      });

      // Finalize PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      return url;
    } catch (error) {
      console.log("Error modifying PDF:", error);
      return null;
    }
  };

  // Generate PDFs when certificates change
  useEffect(() => {
    const generatePDFs = async () => {
      const updatedCerts = await Promise.all(
        certificates.map(async (cert) => {
          const pdfUrl = await modifyPDF(cert);
          return { ...cert, pdfUrl };
        })
      );
      setCertificates(updatedCerts);
    };

    generatePDFs();
  }, []);

  // const getCurrentLevel = (): Level => {
  //   return (
  //     levelData.find(
  //       (level) =>
  //         totalPoints >= level.minPoints && totalPoints < level.maxPoints
  //     ) || levelData[0]
  //   );
  // };

  // const getNextLevel = (): Level | null => {
  //   const currentLevel = getCurrentLevel();
  //   const currentIndex = levelData.indexOf(currentLevel);
  //   return currentIndex < levelData.length - 1
  //     ? levelData[currentIndex + 1]
  //     : null;
  // };

  // const getProgressToNextLevel = (): number => {
  //   const currentLevel = getCurrentLevel();
  //   const nextLevel = getNextLevel();
  //   if (!nextLevel) return 100;
  //   const progress =
  //     ((totalPoints - currentLevel.minPoints) /
  //       (nextLevel.minPoints - currentLevel.minPoints)) *
  //     100;
  //   return Math.min(progress, 100);
  // };

  // --- Reusable Sub-Components ---

  // const LevelCard = ({ level, isActive, isUnlocked }: LevelCardProps): JSX.Element => (
  //   <div className={`relative flex flex-col items-center p-4 rounded-2xl transition-all duration-300 ${isActive ? 'border-2 border-blue-500 bg-blue-50 shadow-lg scale-105' : isUnlocked ? 'border border-gray-200 bg-white shadow-sm' : 'border border-gray-200 bg-gray-50 opacity-60'}`}>
  //     <div className={`relative w-16 h-16 rounded-full flex items-center justify-center mb-3 ${isActive ? 'bg-blue-500' : isUnlocked ? (level.color === 'green' ? 'bg-green-500' : level.color === 'teal' ? 'bg-teal-500' : level.color === 'blue' ? 'bg-blue-500' : 'bg-purple-500') : 'bg-gray-300'} ${!isUnlocked ? 'grayscale' : ''}`}>
  //       {isUnlocked ? <Trophy className="w-8 h-8 text-white" /> : <Lock className="w-6 h-6 text-white" />}
  //     </div>
  //     <div className="text-center">
  //       <h3 className={`text-sm font-semibold mb-1 ${isUnlocked ? 'text-gray-800' : 'text-gray-400'}`}>{level.name}</h3>
  //       <p className={`text-xs ${isUnlocked ? 'text-gray-600' : 'text-gray-400'}`}>{level.range}</p>
  //     </div>
  //     {isActive && <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"><Star className="w-4 h-4 text-white fill-current" /></div>}
  //   </div>
  // );

  const AchievementCard = ({
    achievement,
    isEarned,
  }: AchievementCardProps): JSX.Element => {
    const canClaim = isEarned && !achievement.rewardClaimed;
    const nameRef = useRef<HTMLHeadingElement>(null);
    const descRef = useRef<HTMLParagraphElement>(null);
    const [nameLines, setNameLines] = useState(1);
    const [descLines, setDescLines] = useState(1);

    useEffect(() => {
      const getLineCount = (el: HTMLElement | null): number => {
        if (!el) return 1;
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "16");
        return Math.round(el.scrollHeight / lineHeight);
      };
      setNameLines(getLineCount(nameRef.current));
      setDescLines(getLineCount(descRef.current));
    }, [achievement.name, achievement.description]);

    const getProgressValue = (): number | null => {
      if (!userStats || achievement.threshold == null) return null;

      if (achievement.key.startsWith("usage_")) {
        return userStats.totalUsageSec;
      }
      if (achievement.key.startsWith("topics_")) {
        return userStats.totalTopicsDone;
      }
      if (achievement.key.startsWith("streak_")) {
        return userStats.currentStreak;
      }
      return null;
    };

    const rawValue = getProgressValue();
    const percent =
      rawValue != null
        ? Math.min(Math.round((rawValue / achievement.threshold!) * 100), 100)
        : 0;

    return (
      <div
        className={`relative p-4 rounded-xl border transition-all duration-300 ${
          isEarned
            ? canClaim
              ? "border-blue-300 bg-blue-200 shadow-md"
              : "border-gray-200 bg-gray-50"
            : "border-gray-200 bg-white hover:border-blue-500"
        }`}
      >
        <div
          className={`relative flex flex-col items-center p-2 rounded-2xl transition-all duration-300 ${
            !isEarned ? "grayscale" : ""
          }`}
        >
          {achievement.iconUrl ? (
            <img
              src={achievement.iconUrl}
              alt={achievement.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <Star
              className={`w-8 h-8 ${
                isEarned ? "text-blue-600" : "text-gray-400"
              }`}
            />
          )}
        </div>

        <div className="flex-1 text-center">
          <h4
            ref={nameRef}
            className={`font-semibold text-sm ${
              nameLines > 1 || descLines > 1 ? "mb-1" : "mb-6"
            } ${isEarned ? "text-gray-800" : "text-gray-600"}`}
          >
            {achievement.name}
          </h4>
          <p
            ref={descRef}
            className={`text-xs ${
              descLines >= 3 ? "mb-2" : descLines === 2 ? "mb-6" : "mb-6"
            } ${isEarned ? "text-gray-600" : "text-gray-500"}`}
          >
            {achievement.description}
          </p>

          {rawValue != null && achievement.threshold != null && !isEarned && (
            <div className="mb-2">
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-700 to-blue-500 h-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 text-right mt-1">
                {percent}%
              </p>
            </div>
          )}

          <div className="flex justify-center gap-2 flex-wrap">
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                isEarned
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {achievement.pointValue} points
            </span>
            {isEarned && achievement.awardedAt && (
              <span className="text-xs text-gray-500">
                Earned {new Date(achievement.awardedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {canClaim && (
          <>
            <div className="absolute inset-0 backdrop-blur-[2.5px] rounded-xl"></div>

            <button
              onClick={() => claimReward(achievement.key)}
              disabled={claimingReward === achievement.key}
              className="absolute z-2 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-full text-xs font-medium transition-colors flex items-center justify-center gap-2 shadow-md w-32 h-10 drop-shadow-sm"
            >
              {claimingReward === achievement.key ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Claiming...
                </>
              ) : (
                <>Claim Reward</>
              )}
            </button>
          </>
        )}

        {isEarned && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    );
  };

  // --- Main Render Logic ---

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your achievements...</p>
        </div>
      </div>
    );
  }

  const categoryIcons: { [key: string]: JSX.Element } = {
    Topics: <BookOpen className="w-5 h-5" />,
    Usage: <Clock className="w-5 h-5" />,
    Streak: <Calendar className="w-5 h-5" />,
    Default: <Star className="w-5 h-5" />,
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mx-auto">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "rewards" | "certifications")}
          className="w-full"
        >
          <TabsList className="w-full mb-8 px-2 py-4">
            <TabsTrigger className="w-full" value="rewards">
              Rewards
            </TabsTrigger>
            <TabsTrigger className="w-full" value="certifications">
              Certifications
            </TabsTrigger>
          </TabsList>
          <TabsContent value="rewards">
            <main className="space-y-8">
              {achievements.map((category) => (
                <section key={category.category}>
                  <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-3">
                    {categoryIcons[category.category] || categoryIcons.Default}
                    {category.category} Achievements
                    <span className="text-sm font-normal text-gray-500">
                      ({category.earned.length} earned,{" "}
                      {category.available.length} available)
                    </span>
                  </h2>
                  {(category.earned.length > 0 ||
                    category.available.length > 0) && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                      {category.earned.map((achievement) => (
                        <AchievementCard
                          key={achievement.id}
                          achievement={achievement}
                          isEarned={true}
                          userStats={userStats}
                        />
                      ))}
                      {category.available.map((achievement) => (
                        <AchievementCard
                          key={achievement.id}
                          achievement={achievement}
                          isEarned={false}
                          userStats={userStats}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </main>
          </TabsContent>
          <TabsContent value="certifications">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
              {certificates.map((cert, index) => (
                <Dialog key={index}>
                  <DialogTrigger asChild>
                    <div className="bg-white border transition-all hover:border-blue-500 rounded-lg p-6 flex items-center cursor-pointer">
                      <div className="me-3">
                        <CertificateIcon className="w-30 h-30 text-blue-500" />
                      </div>
                      <div className="mb-4 flex flex-col">
                        <div className="text-blue-500 mb-4">
                          <i className="fas fa-certificate"></i>
                        </div>
                        <p className="text-gray-500 text-sm">
                          Issue {cert.issueDate}
                        </p>
                        <h2 className="text-gray-800 text-sm font-medium mt-2">
                          {cert.title}
                        </h2>
                      </div>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-full sm:max-w-lg md:max-w-2xl lg:max-w-4xl w-full p-4 sm:p-6 md:p-8 bg-white rounded-lg shadow-lg overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg sm:text-xl md:text-2xl font-semibold">
                        {cert.title}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="w-full h-full bg-white rounded-lg overflow-hidden">
                      {cert.pdfUrl ? (
                        <Worker
                          workerUrl={`https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`}
                        >
                          <Viewer fileUrl={cert.pdfUrl} />
                        </Worker>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-4 mt-4">
                      <Button
                        onClick={() => {
                          if (cert.pdfUrl) {
                            const link = document.createElement("a");
                            link.href = cert.pdfUrl;
                            link.download = `${
                              cert.studentName
                            }_${cert.title.replace(/\s+/g, "_")}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        className="bg-white text-[#065FF0] border border-[#065FF033] hover:bg-[#f0f6ff] hover:border-[#065FF0] transition-colors duration-200 shadow-sm p-4 sm:p-5"
                      >
                        <DownloadIcon className="w-4 h-4 mr-2" />
                        Download
                      </Button>

                      <Button className="bg-[#065FF01A] text-[#065FF0] border border-[#065FF033] hover:bg-[#e6f0ff] hover:border-[#065FF0] transition-colors duration-200 shadow-sm p-4 sm:p-5">
                        <ShareIcon className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Rewards;
