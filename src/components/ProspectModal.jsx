import { useState, useEffect, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
} from "@heroui/react";
import { Edit, Mail, X } from "lucide-react";
import { postGenerateResponse } from "../utils/fetcher";
import { RESPONSE_GENERATOR_API_URL, SEND_EMAIL_API_URL } from "../utils/api";
import { campaignsFacade } from "../utils/dataFacade";

export default function ProspectModal({ isOpen, onClose, prospect, campaignId, onProspectUpdate }) {
  const [editableValue, setEditableValue] = useState("");
  
  // Log pour tracer les changements de editableValue
  useEffect(() => {
    console.log("📝 editableValue changé:", editableValue.substring(0, 50) + (editableValue.length > 50 ? "..." : ""));
  }, [editableValue]);
  const [isEditing, setIsEditing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [countdownInterval, setCountdownInterval] = useState(null);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const lastProcessedProspectIdRef = useRef(null);

  const generateAIResponse = async (prospectData, campaignId) => {
    console.log("🚀 DEBUT generateAIResponse pour prospect:", prospectData.id);
    
    if (!prospectData.clean_body || !prospectData.label) {
      console.log("❌ Données insuffisantes pour générer une réponse");
      return;
    }

    // Vérifier si une réponse existe déjà dans le localStorage
    if (prospectData.ai_response) {
      console.log("✅ Réponse IA déjà générée, utilisation du cache");
      setEditableValue(prospectData.ai_response);
      return;
    }

    console.log("🔄 Début de génération IA...");
    setIsGeneratingResponse(true);
    setEditableValue(""); // Vider le contenu pendant la génération
    try {
      const response = await postGenerateResponse(RESPONSE_GENERATOR_API_URL, {
        classification_result: { label: prospectData.label },
        original_email: prospectData.clean_body,
        context: {},
        tone: "professional, concise",
        language: "fr"
      });
      
      console.log("📨 Réponse IA reçue:", response);
      console.log("📝 response_text:", response.response_text);
      
      // Extraire le texte de la réponse qui est dans un format JSON markdown
      let responseText = response.response_text;
      if (responseText && typeof responseText === 'string') {
        try {
          // Enlever les backticks markdown et parser le JSON interne
          const cleanJson = responseText.replace(/```json\n/, '').replace(/\n```$/, '');
          const parsedResponse = JSON.parse(cleanJson);
          const actualText = parsedResponse.response_text;
          
          // Remplacer les \n par de vrais retours à la ligne
          const formattedText = actualText.replace(/\\n/g, '\n');
          console.log("✏️ MISE A JOUR du textarea avec:", formattedText.substring(0, 50) + "...");
          setEditableValue(formattedText);
          
          // Sauvegarder la réponse dans le localStorage
          const campaigns = campaignsFacade.load();
          const updatedCampaigns = campaigns.map(campaign => {
            if (campaign.id.toString() === campaignId.toString()) {
              return {
                ...campaign,
                prospects: campaign.prospects.map(p => 
                  p.id === prospectData.id 
                    ? { ...p, ai_response: formattedText }
                    : p
                )
              };
            }
            return campaign;
          });
          campaignsFacade.save(updatedCampaigns);
          console.log("💾 Réponse IA sauvegardée dans localStorage");
          
          // La sauvegarde en localStorage suffit, pas besoin de notifier le parent immédiatement
          // pour éviter les conflits de re-render pendant la génération
          
        } catch (parseError) {
          console.error("Erreur lors du parsing du JSON interne:", parseError);
          setEditableValue("Erreur lors du parsing de la réponse");
        }
      } else {
        console.error("response_text manquant ou invalide:", responseText);
        setEditableValue("Erreur: réponse invalide");
      }
    } catch (error) {
      console.error("Erreur lors de la génération de réponse:", error);
      setEditableValue("Erreur lors de la génération de la réponse");
    } finally {
      console.log("🏁 FIN generateAIResponse");
      setIsGeneratingResponse(false);
    }
  };

  useEffect(() => {
    console.log("🔄 useEffect déclenché - prospect.id:", prospect?.id, "isOpen:", isOpen, "isGeneratingResponse:", isGeneratingResponse, "lastProcessed:", lastProcessedProspectIdRef.current);
    
    if (prospect && isOpen && !isGeneratingResponse && prospect.id !== lastProcessedProspectIdRef.current) {
      console.log("⚙️ Initialisation de la modale...");
      
      // Marquer ce prospect comme traité IMMÉDIATEMENT pour éviter les appels multiples
      lastProcessedProspectIdRef.current = prospect.id;
      
      // Réinitialiser le mode édition et l'état de validation
      setIsEditing(false);
      setIsValidating(false);
      setCountdown(0);
      if (countdownInterval) {
        clearInterval(countdownInterval);
        setCountdownInterval(null);
      }
      
      // Si une réponse existe déjà, l'utiliser directement
      if (prospect.ai_response) {
        console.log("📋 Réponse existante trouvée, chargement...");
        setEditableValue(prospect.ai_response);
      } else {
        console.log("🆕 Aucune réponse existante, génération...");
        // Générer automatiquement la réponse IA seulement si elle n'existe pas
        generateAIResponse(prospect, campaignId);
      }
    }
  }, [prospect?.id, isOpen]);

  // Nettoyer l'intervalle lors du démontage du composant
  useEffect(() => {
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, []);

  // Réinitialiser le lastProcessedProspectId quand la modale se ferme
  useEffect(() => {
    if (!isOpen) {
      lastProcessedProspectIdRef.current = null;
    }
  }, [isOpen]);

  const getLabelColor = (label) => {
    const colorMap = {
      rendez_vous: "success", // Vert - positif, RDV
      demande_infos: "primary", // Bleu - neutre, demande d'info
      plus_tard: "warning", // Orange - potentiel futur
      deja_client: "secondary", // Gris - déjà acquis
      pas_interesse: "danger", // Rouge - négatif, refus
      erreur: "danger", // Rouge - problème
      hors_scope: "danger", // Rouge - pas la cible
      autre: "default", // Gris par défaut
    };
    return colorMap[label] || "default";
  };

  const startValidation = () => {
    setIsValidating(true);
    setCountdown(5);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setCountdownInterval(null);
          // Envoyer le message après 5 secondes
          handleSave();
          setIsValidating(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setCountdownInterval(interval);
  };

  const cancelValidation = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }
    setIsValidating(false);
    setCountdown(0);
    console.log("Envoi annulé");
  };

  const handleSave = async () => {
    console.log("Validation réponse IA:", editableValue);
    
    try {
      // Construire le body de la requête avec les données du localStorage et la réponse IA
      const requestBody = {
        sendUserId: prospect.sendUserId,
        sendUserEmail: "lpincon@enerlis.eu",
        sendUserMailboxId: prospect.sendUserMailboxId,
        contactId: prospect.contactId,
        leadId: prospect.lead_id,
        subject: `Re: ${prospect.content?.replace(/^Re:\s*/i, '')}`,
        message: editableValue
      };

      console.log("🚀 Envoi de l'email avec les données:", requestBody);
      console.log("📋 Vérification des données:");
      console.log("  - sendUserId:", requestBody.sendUserId);
      console.log("  - sendUserEmail:", requestBody.sendUserEmail);
      console.log("  - sendUserMailboxId:", requestBody.sendUserMailboxId);
      console.log("  - contactId:", requestBody.contactId);
      console.log("  - leadId:", requestBody.leadId);
      console.log("  - subject:", requestBody.subject);
      console.log("  - message length:", requestBody.message?.length || 0);

      const response = await fetch(SEND_EMAIL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Email envoyé avec succès:", result);
      } else {
        const errorText = await response.text();
        console.error("❌ Erreur lors de l'envoi de l'email:", response.status, response.statusText);
        console.error("❌ Détail de l'erreur:", errorText);
      }
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi de l'email:", error);
    }
    
    setIsValidating(false);
    setCountdown(0);
  };

  const handleClose = () => {
    // Notifier le parent avec la version à jour du prospect avant de fermer
    if (onProspectUpdate && prospect) {
      const campaigns = campaignsFacade.load();
      const updatedProspect = campaigns
        .find(c => c.id.toString() === campaignId.toString())
        ?.prospects.find(p => p.id === prospect.id);
      if (updatedProspect) {
        onProspectUpdate(updatedProspect);
      }
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="3xl"
      backdrop="blur"
      className="bg-gray-100 p-4"
      radius="none"
      hideCloseButton={true}
    >
      <ModalContent className="relative">
        <ModalHeader className="flex justify-between items-center">
          <p className="text-2xl font-semibold">{prospect?.name}</p>
          <Chip
            color={prospect?.label ? getLabelColor(prospect.label) : "default"}
            variant="bordered"
            className="flex"
            radius="none"
            size="lg"
          >
            {prospect?.label ? `${prospect.label} (${prospect.confidence})` : "Label"}
          </Chip>
        </ModalHeader>

        <ModalBody className="py-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-medium">Retour prospect</h3>
              <div className="p-3 bg-gray-200 border border-gray-300 h-32 overflow-y-auto rounded-none">
                <p className="text-sm whitespace-pre-line">
                  {prospect?.content}
                  {prospect?.content && prospect?.clean_body && "\n\n"}
                  {prospect?.clean_body}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium">Réponse IA</h3>
              <textarea
                value={isGeneratingResponse ? "Génération de la réponse en cours..." : editableValue}
                onChange={(e) => setEditableValue(e.target.value)}
                disabled={!isEditing || isGeneratingResponse}
                className={`w-full !text-sm h-32 p-3 border border-gray-300 rounded-none overflow-y-auto resize-none ${
                  isEditing && !isGeneratingResponse ? "bg-white" : "bg-gray-200"
                }`}
              />
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="justify-center gap-4">
          <Button
            color="warning"
            variant="solid"
            radius="none"
            disableRipple
            startContent={<Edit size={18} />}
            onPress={() => setIsEditing(!isEditing)}
            isDisabled={isValidating || isGeneratingResponse}
          >
            {isEditing ? "Verrouillé" : "Déverrouillé"}
          </Button>

          {!isValidating ? (
            <Button
              color="success"
              variant="solid"
              radius="none"
              disableRipple
              startContent={<Mail size={18} />}
              onPress={startValidation}
              isDisabled={isGeneratingResponse}
            >
              Répondre
            </Button>
          ) : (
            <>
              <Button
                color="success"
                variant="solid"
                radius="none"
                disableRipple
                startContent={<Mail size={18} />}
                isDisabled={true}
              >
                Envoi dans {countdown}s...
              </Button>
              <Button
                color="danger"
                variant="solid"
                radius="none"
                disableRipple
                startContent={<X size={18} />}
                onPress={cancelValidation}
              >
                Annuler
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
