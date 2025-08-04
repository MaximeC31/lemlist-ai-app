const CAMPAIGNS_STORAGE_KEY = "campaigns_data";

const groupEmailResponsesByCampaign = (campaigns) => {
  const emailResponsesByCampaign = {};
  
  campaigns.forEach((campaign) => {
    if (Array.isArray(campaign.emailResponses)) {
      campaign.emailResponses.forEach((response) => {
        const campaignId = response.campaignId;
        emailResponsesByCampaign[campaignId] ??= [];
        emailResponsesByCampaign[campaignId].push(response);
      });
    }
  });
  
  return emailResponsesByCampaign;
};

const mapResponseToProspect = (response, campaignId, index) => {
  const [firstName, ...lastNameParts] = (response.from?.name || "").split(" ");
  
  return {
    id: response.contactId || response.lead_id || `${campaignId}_${index + 1}`,
    firstName: firstName || "",
    lastName: lastNameParts.join(" ") || "",
    name: response.from?.name || response.companyName || `Prospect ${index + 1}`,
    email: response.from?.email || "",
    companyName: response.companyName || "",
    content: response.subject || "",
    body: response.body || "",
    clean_body: "",
    receivedAt: response.received_at || "",
    sendUserId: response.sendUserId || "",
    sendUserEmail: response.sendUserEmail || "",
    sendUserMailboxId: response.sendUserMailboxId || "",
    contactId: response.contactId || "",
    lead_id: response.lead_id || "",
  };
};

export const campaignsFacade = {
  normalize: (serverData) => {
    if (!serverData?.campaigns || !Array.isArray(serverData.campaigns)) {
      return [];
    }

    const emailResponsesByCampaign = groupEmailResponsesByCampaign(serverData.campaigns);

    return serverData.campaigns.map((campaign, index) => ({
      id: campaign.id || index + 1,
      name: campaign.name || campaign.title || `Campaign ${index + 1}`,
      prospects: (emailResponsesByCampaign[campaign.id] || [])
        .map((response, responseIndex) => 
          mapResponseToProspect(response, campaign.id, responseIndex)
        ),
    }));
  },

  save: (data) => {
    try {
      localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  },

  load: () => {
    try {
      const data = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  clear: () => {
    try {
      localStorage.removeItem(CAMPAIGNS_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  },
};
