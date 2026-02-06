interface Business {
  name: string;
  category: string;
  address: string;
}

interface Email {
  subject: string;
  body: string;
}

export function renderEmailTemplate(business: Business, template: string): Email {
  if (template === 'restaurant-intro') {
    return {
      subject: `Transform ${business.name} with AI`,
      body: `Dear ${business.name},

We help restaurant operations become more efficient with AI-powered automation.

Your restaurant at ${business.address} could benefit from:
- Automated order management
- Smart scheduling
- Customer engagement tools

Best regards,
SrvcFlo AI Team`
    };
  }

  if (template === 'professional-services-intro') {
    return {
      subject: `Automate ${business.name} with AI`,
      body: `Dear ${business.name},

We specialize in helping professional services automate client scheduling and follow-ups.

Your practice at ${business.address} could benefit from:
- Automated appointment scheduling
- Client communication automation
- Smart follow-up reminders

Best regards,
SrvcFlo AI Team`
    };
  }

  if (template === 'retail-intro') {
    return {
      subject: `Transform ${business.name} with AI`,
      body: `Dear ${business.name},

We help retail businesses with inventory management and customer engagement.

Your store at ${business.address} could benefit from:
- Smart inventory management
- Customer engagement automation
- Sales analytics and insights

Best regards,
SrvcFlo AI Team`
    };
  }

  if (template === 'health-fitness-intro') {
    return {
      subject: `Streamline ${business.name} with AI`,
      body: `Dear ${business.name},

We help health and fitness businesses with member management and scheduling.

Your facility at ${business.address} could benefit from:
- Automated member management
- Smart scheduling systems
- Membership engagement tools

Best regards,
SrvcFlo AI Team`
    };
  }

  if (template === 'home-services-intro') {
    return {
      subject: `Optimize ${business.name} with AI`,
      body: `Dear ${business.name},

We help home service businesses with job tracking and customer follow-ups.

Your business at ${business.address} could benefit from:
- Automated job tracking
- Smart customer follow-ups
- Service scheduling automation

Best regards,
SrvcFlo AI Team`
    };
  }

  throw new Error(`Unknown template: ${template}`);
}
