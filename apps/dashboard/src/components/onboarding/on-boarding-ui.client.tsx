"use client";

import { Spinner } from "@/components/ui/Spinner/Spinner";
import type { Account } from "@3rdweb-sdk/react/hooks/useApi";
import { Suspense, lazy, useState } from "react";
import { ChakraProviderSetup } from "../../@/components/ChakraProviderSetup";
import { useTrack } from "../../hooks/analytics/useTrack";
import { LazyOnboardingBilling } from "./LazyOnboardingBilling";
import { OnboardingModal } from "./Modal";
import type { OnboardingState } from "./types";
import { skipBilling } from "./utils";

const OnboardingConfirmEmail = lazy(() => import("./ConfirmEmail"));
const OnboardingLinkWallet = lazy(() => import("./LinkWallet"));
const OnboardingGeneral = lazy(() => import("./General"));
const OnboardingChoosePlan = lazy(() => import("./ChoosePlan"));

function OnboardingUI(props: {
  account: Account;
  state: OnboardingState;
  onOpenChange?: (open: boolean) => void;
  setState: (state: OnboardingState) => void;
}) {
  const trackEvent = useTrack();
  const { account, state, setState, onOpenChange } = props;
  const [updatedEmail, setUpdatedEmail] = useState<string | undefined>();

  const handleSave = (email?: string) => {
    // if account is not ready yet we cannot do anything here
    if (!account) {
      return;
    }

    let nextStep: OnboardingState = undefined;

    switch (state) {
      case "onboarding":
        nextStep = "confirming";
        break;
      case "linking":
        nextStep = "confirmLinking";
        break;
      case "confirming":
        nextStep =
          skipBilling(account) || account?.trialPeriodEndedAt
            ? "skipped"
            : "plan";
        break;
      case "confirmLinking":
        nextStep = "skipped";
        break;
      case "plan":
        nextStep = "billing";
        break;
      case "billing":
        nextStep = "skipped";
        break;
      default:
      // ignore, already undefined
    }

    trackEvent({
      category: "account",
      action: "onboardingStep",
      label: "next",
      data: {
        email: email || account.unconfirmedEmail || updatedEmail,
        currentStep: state,
        nextStep,
      },
    });

    setState(nextStep);
  };

  const handleDuplicateEmail = (email: string) => {
    // if account is not ready yet we cannot do anything here
    if (!account) {
      return;
    }

    trackEvent({
      category: "account",
      action: "onboardingStep",
      label: "next",
      data: {
        email,
        currentStep: state,
        nextStep: "linking",
      },
    });

    setState("linking");
  };

  return (
    <ChakraProviderSetup>
      <OnboardingModal
        isOpen={!!state}
        wide={state === "plan"}
        onOpenChange={onOpenChange}
      >
        {state === "onboarding" && (
          <Suspense fallback={<Loading />}>
            <OnboardingGeneral
              account={account}
              onSave={(email) => {
                setUpdatedEmail(email);
                handleSave(email);
              }}
              onDuplicate={(email) => {
                setUpdatedEmail(email);
                handleDuplicateEmail(email);
              }}
            />
          </Suspense>
        )}

        {state === "linking" && (
          <Suspense fallback={<Loading />}>
            <OnboardingLinkWallet
              onSave={handleSave}
              onBack={() => {
                setUpdatedEmail(undefined);
                setState("onboarding");
              }}
              email={updatedEmail as string}
            />
          </Suspense>
        )}

        {(state === "confirming" || state === "confirmLinking") && (
          <Suspense fallback={<Loading />}>
            <OnboardingConfirmEmail
              linking={state === "confirmLinking"}
              onSave={handleSave}
              onBack={() => setState("onboarding")}
              email={(account.unconfirmedEmail || updatedEmail) as string}
            />
          </Suspense>
        )}

        {state === "plan" && (
          <Suspense fallback={<Loading />}>
            <OnboardingChoosePlan onSave={handleSave} />
          </Suspense>
        )}

        {state === "billing" && (
          <LazyOnboardingBilling
            onSave={handleSave}
            onCancel={() => setState("skipped")}
          />
        )}
      </OnboardingModal>
    </ChakraProviderSetup>
  );
}

function Loading() {
  return (
    <div className="flex h-[200px] items-center justify-center">
      <Spinner className="size-5" />
    </div>
  );
}

export default OnboardingUI;
