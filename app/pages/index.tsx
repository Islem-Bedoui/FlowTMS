import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faLock } from "@fortawesome/free-solid-svg-icons";

const LoginPage = () => {
  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier || !password) {
      setError("Tous les champs sont requis.");
      return;
    }

    try {
      // Fetch users from /api/login
      const loginResponse = await fetch("/api/login");
      const loginData = await loginResponse.json();
      const users = loginData.value;

      // Fetch chauffeurs (used to determine TruckRole)
      const chauffeursResponse = await fetch("/api/chauffeurs", { cache: "no-store" });
      const chauffeursData = await chauffeursResponse.json();
      const chauffeurs = chauffeursData.value;

      // Fetch customers from /api/customer
      const customerResponse = await fetch("/api/customer");
      const customerData = await customerResponse.json();
      const customers = customerData.value;

      // Check if user exists in /api/login and validate password
      const user = users.find(
        (user: { No: string; Password: string }) =>
          user.No === identifier && user.Password === password
      );

      // Check if identifier matches a customer in /api/customer
      const customer = customers.find(
        (customer: { contact: string }) => customer.contact === identifier 
      );

      let role: string | null = null;
      let redirectPath: string | null = null;
      let driverNo: string | null = null;

      const normalizedIdentifier = identifier.trim().toLowerCase().replace(/\s+/g, "");

      // Determine role
      if (user) {
        const chauffeur = Array.isArray(chauffeurs)
          ? chauffeurs.find((c: any) => {
              const no = String(c?.No || "").trim().toLowerCase().replace(/\s+/g, "");
              const name = String(c?.Name || "").trim().toLowerCase().replace(/\s+/g, "");
              return no === normalizedIdentifier || name === normalizedIdentifier;
            })
          : null;

        if (!chauffeur) {
          setError("Accès refusé: aucun chauffeur trouvé pour cet utilisateur.");
          setSuccess("");
          return;
        }

        const truckRole = String((chauffeur as any)?.TruckRole || "").trim().toLowerCase();
        role = truckRole || "driver";

        if (role === "admin") {
          redirectPath = "/dashboard";
          localStorage.removeItem("driverNo");
        } else {
          role = "driver";
          driverNo = String((chauffeur as any)?.No || "").trim();
          redirectPath = "/dashboard";
        }
      } else if (customer) {
        // Assume customer uses same password as in /api/login or skip password check
        // If customer has separate password, add validation here
        role = "customer";
        redirectPath = "/dashboard";
      }

      if (user || customer) {
        setSuccess("Connexion réussie !");
        setError("");
        localStorage.setItem("userIdentifier", identifier);
        localStorage.setItem("userRole", role!);
        if (driverNo) localStorage.setItem("driverNo", driverNo);
        else localStorage.removeItem("driverNo");
        router.push(redirectPath!);
      } else {
        setError("Identifiant ou mot de passe incorrect.");
        setSuccess("");
      }
    } catch (err) {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setSuccess("");
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-10 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl animate-pulse [animation-delay:300ms]"></div>
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-purple-400/10 blur-3xl animate-pulse [animation-delay:600ms]"></div>
      </div>

      <div className="w-full max-w-lg backdrop-blur-xl bg-white/70 border border-white/50 shadow-2xl rounded-2xl overflow-hidden transition-transform duration-300 hover:scale-[1.01]">
        <div className="w-full flex flex-col items-center justify-center bg-white/60 px-8 pt-8 pb-4">
          <Image
            src="/Logo AlmaTrack Bleu png.png"
            alt="Logo"
            width={420}
            height={140}
            priority
            className="h-52 w-auto object-contain drop-shadow-sm"
          />
          <p className="mt-2 text-sm text-gray-600">Plateforme de gestion logistique</p>
        </div>

        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
            Connexion
          </h2>
          <p className="text-center text-gray-500 mb-6 text-sm">Accédez à votre espace sécurisé</p>

          {success && (
            <div className="bg-green-100 text-green-700 p-2 rounded mb-4">
              {success}
            </div>
          )}
          {error && (
            <div className="bg-red-100 text-red-700 p-2 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-5 relative">
              <label
                htmlFor="identifier"
                className="block text-sm font-medium text-gray-700"
              >
                Nom d'utilisateur
              </label>
              <div className="relative flex items-center">
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full mt-1 p-3 pl-12 rounded-lg border border-gray-300 bg-white/80 shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition"
                  placeholder="Votre identifiant"
                />
                <FontAwesomeIcon
                  icon={faUser}
                  className="absolute left-3 h-5 w-5 text-blue-500/70"
                />
                <div className="absolute left-10 h-6 border-l border-gray-300/70"></div>
              </div>
            </div>

            <div className="mb-6 relative">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Mot de passe
              </label>
              <div className="relative flex items-center">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full mt-1 p-3 pl-12 rounded-lg border border-gray-300 bg-white/80 shadow-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500 transition"
                  placeholder="Votre mot de passe"
                />
                <FontAwesomeIcon
                  icon={faLock}
                  className="absolute left-3 h-5 w-5 text-blue-500/70"
                />
                <div className="absolute left-10 h-6 border-l border-gray-300/70"></div>
              </div>
            </div>

            <button
              type="submit"
              className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 shadow-lg transition-transform duration-200 hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-blue-200"
            >
              <span className="relative z-10 font-semibold tracking-wide">Se connecter</span>
              <span className="absolute inset-0 -z-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;














